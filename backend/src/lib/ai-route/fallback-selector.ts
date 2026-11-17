// Composite StopSelector: tries the primary model, and when it is rate-limited
// (Groq 429, including "request too large" OTPM rejections) retries the same
// request on a secondary model. After a 429 the primary is skipped for the
// retry-after period, so later requests do not pay for a call that will fail.
//
// The cooldown lives on the instance. route.ts creates one instance at module
// scope, so it is shared by all requests handled by that server process (not
// across serverless instances, and reset when the dev server reloads the module).

import { SelectorError, type SelectionRequest, type SelectionResponse, type StopSelector } from "./groq";

/** Error kinds that mean "this model cannot serve now, another one might". */
const FALLBACK_ON: ReadonlySet<SelectorError["kind"]> = new Set(["rate_limited"]);
/** Don't start the secondary call with less time than this left in the attempt. */
export const MIN_SECONDARY_MS = 2_000;
/** Used when Groq sends no retry-after header. OTPM/RPM windows are one minute. */
export const DEFAULT_COOLDOWN_MS = 60_000;
export const MAX_COOLDOWN_MS = 5 * 60_000;

export interface FallbackSelectorOptions {
  now?: () => number;
  /** Log label for each side, e.g. the model name. */
  primaryName?: string;
  secondaryName?: string;
}

export class FallbackStopSelector implements StopSelector {
  private primaryBlockedUntil = 0;
  private readonly now: () => number;
  private readonly primaryName: string;
  private readonly secondaryName: string;

  constructor(
    private readonly primary: StopSelector,
    private readonly secondary: StopSelector,
    opts: FallbackSelectorOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.primaryName = opts.primaryName ?? "primary";
    this.secondaryName = opts.secondaryName ?? "secondary";
  }

  /** True while the primary is in its post-429 cooldown. Exposed for tests/diagnostics. */
  isPrimaryCoolingDown(): boolean {
    return this.now() < this.primaryBlockedUntil;
  }

  async selectStops(req: SelectionRequest, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<SelectionResponse> {
    if (this.isPrimaryCoolingDown()) return this.secondary.selectStops(req, opts);

    const startedAt = this.now();
    try {
      return await this.primary.selectStops(req, opts);
    } catch (err) {
      if (!(err instanceof SelectorError) || !FALLBACK_ON.has(err.kind)) throw err;

      this.primaryBlockedUntil = this.now() + cooldownMs(err.message);
      const left = opts.timeoutMs - (this.now() - startedAt);
      if (left < MIN_SECONDARY_MS || opts.signal?.aborted) throw err;

      console.warn(`[ai-route] ${this.primaryName} rate-limited; retrying on ${this.secondaryName}`);
      return this.secondary.selectStops(req, { ...opts, timeoutMs: left });
    }
  }
}

/** Reads "retry-after=N" (seconds) written into the error message by describeRateLimit(). */
export function cooldownMs(message: string): number {
  const seconds = Number(/retry-after=(\d+(?:\.\d+)?)/.exec(message)?.[1]);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_COOLDOWN_MS)
    : DEFAULT_COOLDOWN_MS;
}
