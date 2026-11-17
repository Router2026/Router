// Assistant tools. Closed world: the model can only show / add places that exist in the DB,
// and only remove places that are in the user's route. Every argument is validated here;
// the model's JSON is untrusted input.

import { z } from "zod";
import { sanitizeForPrompt } from "@/lib/ai-route/text";
import type { SearchInput, SearchOutput } from "@/lib/search/search";
import type { ToolDefinition } from "./model";
import { MAX_ROUTE_ITEMS, type AssistantAction, type Place, type PlaceRef } from "./types";

export const MAX_SHOWN_PLACES = 6;

export interface ToolDeps {
  search: (input: SearchInput) => Promise<SearchOutput>;
  /** Fetch places by id in the slim list shape (with distance when `near` is given). */
  lookup: (ids: number[], near: { lat: number; lng: number } | null) => Promise<Place[]>;
}

/** Mutable per-request state the tools read and write. */
export interface ToolContext {
  userLocation: { lat: number; lng: number } | null;
  /** Working copy of the route; starts as the client's bucket and reflects edits made this turn. */
  route: PlaceRef[];
  /** Places returned by searches this turn (id → full place), for cards and adds. */
  found: Map<number, Place>;
  /** Places shown with earlier assistant messages (id → name), so "add the first one" works. */
  previouslyShown: Map<number, string>;
  shown: Place[];
  actions: AssistantAction[];
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_places",
      description:
        "Search Router's database of Israeli nature/travel places. Write the query in Hebrew when possible " +
        "(the content is Hebrew). Region names, 'accessible', 'shaded', 'water', 'challenging' in the query are understood.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, e.g. 'חוף בכנרת' or 'מעיין מוצל ליד זכרון יעקב'" },
          near_user: { type: "boolean", description: "Only places near the user's current location (requires known location)" },
          radius_km: { type: "number", description: "Radius for near_user, 1-100 km. Default 25." },
          limit: { type: "integer", description: "Max results, 1-10. Default 8." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_places",
      description:
        "Display place cards to the user (photo, name, distance, 'add to route' button). Use after search_places " +
        "with the 3-6 best ids, best first. The cards carry the details, so keep your text short.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "integer" }, description: "Place ids, best first" } },
        required: ["ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_route",
      description: "Add a place to the user's route. Only when the user asks to add it. The id must come from search results or earlier shown places.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_from_route",
      description: "Remove a place from the user's route. Only when the user asks. The id must be in the current route.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
];

const SearchArgs = z.object({
  query: z.string().trim().min(1).max(300),
  near_user: z.boolean().optional(),
  radius_km: z.number().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});
const ShowArgs = z.object({ ids: z.array(z.number().int().positive()).min(1).max(20) });
const IdArgs = z.object({ id: z.number().int().positive() });

/** Compact, description-free view for the model: less prompt-injection surface, fewer tokens. */
function forModel(p: Place) {
  return {
    id: p.id,
    name: sanitizeForPrompt(p.name, 120),
    category: p.category,
    region: p.region_name ?? null,
    distance_km: p.distance_meters !== undefined ? Math.round(p.distance_meters / 100) / 10 : null,
    difficulty: p.difficulty,
    accessible: !!p.accessible,
    shaded: !!p.has_shade,
    water: !!p.has_water,
    rating: p.average_rating,
  };
}

function parseArgs<T>(schema: z.ZodType<T>, raw: string): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { ok: false, error: "arguments are not valid JSON" };
  }
  const r = schema.safeParse(json);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues.map((i) => i.message).join("; ") };
}

/** Executes one tool call and returns the JSON-serializable result sent back to the model. */
export async function executeTool(name: string, rawArgs: string, ctx: ToolContext, deps: ToolDeps): Promise<unknown> {
  switch (name) {
    case "search_places": {
      const a = parseArgs(SearchArgs, rawArgs);
      if (!a.ok) return { error: a.error };
      if (a.value.near_user && !ctx.userLocation) {
        return { error: "user location is unknown — ask the user for an area or city instead" };
      }
      const near = ctx.userLocation
        ? { ...ctx.userLocation, radiusM: a.value.near_user ? (a.value.radius_km ?? 25) * 1000 : undefined }
        : null;
      const out = await deps.search({ q: a.value.query, near, limit: a.value.limit ?? 8 });
      for (const p of out.results) ctx.found.set(p.id, p);
      return {
        searched_as: out.meta.searchedAs,
        results: out.results.map(forModel),
        ...(out.results.length === 0 ? { note: "no matches — try a broader query or another area" } : {}),
      };
    }

    case "show_places": {
      const a = parseArgs(ShowArgs, rawArgs);
      if (!a.ok) return { error: a.error };
      const missing = a.value.ids.filter((id) => !ctx.found.has(id) && !ctx.previouslyShown.has(id));
      // Places shown in earlier turns aren't in `found`; fetch their full rows for the cards.
      const toFetch = a.value.ids.filter((id) => !ctx.found.has(id) && ctx.previouslyShown.has(id));
      if (toFetch.length) for (const p of await deps.lookup(toFetch, ctx.userLocation)) ctx.found.set(p.id, p);
      const shownIds = new Set(ctx.shown.map((p) => p.id));
      for (const id of a.value.ids) {
        if (ctx.shown.length >= MAX_SHOWN_PLACES) break;
        const p = ctx.found.get(id);
        if (p && !shownIds.has(id)) {
          ctx.shown.push(p);
          shownIds.add(id);
        }
      }
      return {
        shown: ctx.shown.map((p) => ({ id: p.id, name: p.name })),
        ...(missing.length ? { ignored_unknown_ids: missing } : {}),
      };
    }

    case "add_to_route": {
      const a = parseArgs(IdArgs, rawArgs);
      if (!a.ok) return { error: a.error };
      const { id } = a.value;
      if (ctx.route.some((r) => r.id === id)) return { error: "already in the route" };
      if (ctx.route.length >= MAX_ROUTE_ITEMS) return { error: `route is full (max ${MAX_ROUTE_ITEMS} places)` };
      if (!ctx.found.has(id) && !ctx.previouslyShown.has(id)) {
        return { error: "unknown id — search for the place first" };
      }
      let place = ctx.found.get(id);
      if (!place) {
        [place] = await deps.lookup([id], ctx.userLocation);
        if (!place) return { error: "place no longer exists" };
        ctx.found.set(id, place);
      }
      ctx.route.push({ id, name: place.name });
      ctx.actions.push({ type: "add", place });
      return { ok: true, added: place.name, route: ctx.route };
    }

    case "remove_from_route": {
      const a = parseArgs(IdArgs, rawArgs);
      if (!a.ok) return { error: a.error };
      const idx = ctx.route.findIndex((r) => r.id === a.value.id);
      if (idx === -1) return { error: "that place is not in the route", route: ctx.route };
      const [removed] = ctx.route.splice(idx, 1);
      ctx.actions.push({ type: "remove", id: removed.id, name: removed.name });
      return { ok: true, removed: removed.name, route: ctx.route };
    }

    default:
      return { error: `unknown tool ${name}` };
  }
}
