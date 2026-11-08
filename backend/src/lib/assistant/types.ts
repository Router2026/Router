import { z } from "zod";
import type { LocationWithDistance } from "@/lib/locations/location-service";

/** Limits that bound prompt size and cost per request. */
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_ROUTE_ITEMS = 25;
export const MAX_PLACES_PER_MESSAGE = 10;

const PlaceRefSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
});

export const AssistantRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().max(MAX_MESSAGE_CHARS),
        /** Places shown with an earlier assistant message, so "add the first one" resolves. */
        places: z.array(PlaceRefSchema).max(MAX_PLACES_PER_MESSAGE).optional(),
      }),
    )
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === "user" && m[m.length - 1].content.length > 0, {
      message: "last message must be a non-empty user message",
    }),
  /** Current Trip Bucket contents, in order. The bucket lives on the client. */
  route: z.array(PlaceRefSchema).max(MAX_ROUTE_ITEMS).default([]),
  userLocation: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
});

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type PlaceRef = z.infer<typeof PlaceRefSchema>;

/** Same slim shape as /api/locations/search results, so the frontend maps it with mapRawToPoi. */
export type Place = LocationWithDistance;

export type AssistantAction =
  | { type: "add"; place: Place }
  | { type: "remove"; id: number; name: string };

export interface AssistantResponse {
  reply: string;
  /** Cards to render under the reply, in the order the model chose. */
  places: Place[];
  /** Route edits for the client to apply to its Trip Bucket, in order. */
  actions: AssistantAction[];
  meta: { model: string; toolCalls: number; modelCalls: number; inputTokens: number; outputTokens: number };
}
