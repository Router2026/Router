import type { NewPoi } from "@/lib/db/schema";

export interface SourceAdapter {
  fetchPois(sourceUrl: string): Promise<Partial<NewPoi>[]>;
}

// Blocks private/loopback/link-local ranges and non-HTTPS protocols
const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1$|fc|fd)/i;

function validateSourceUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid source URL: ${raw}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Source URL must use HTTPS (got ${parsed.protocol})`);
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new Error(`Source URL must not point to private or internal hosts`);
  }
}

/**
 * Generic HTTP JSON adapter.
 * Expects the source URL to return a JSON array of objects that partially match NewPoi.
 */
export class HttpJsonSourceAdapter implements SourceAdapter {
  async fetchPois(sourceUrl: string): Promise<Partial<NewPoi>[]> {
    validateSourceUrl(sourceUrl);
    const res = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Source fetch failed: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data))
      throw new Error("Source must return a JSON array");
    return data as Partial<NewPoi>[];
  }
}
