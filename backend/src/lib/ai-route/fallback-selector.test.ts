import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cooldownMs,
  DEFAULT_COOLDOWN_MS,
  FallbackStopSelector,
  MAX_COOLDOWN_MS,
  MIN_SECONDARY_MS,
} from "./fallback-selector";
import { SelectorError, type SelectionRequest, type SelectionResponse, type StopSelector } from "./groq";

const req: SelectionRequest = { system: "sys", user: "usr", allowedKeys: ["L1", "L2"] };

function response(model: string): SelectionResponse {
  return { json: { stops: [] }, raw: "{}", model, mode: "json_object" };
}

/** A manually advanced clock, so cooldown and time-budget logic is deterministic. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

function selector(impl: StopSelector["selectStops"]) {
  const selectStops = vi.fn(impl);
  return { selectStops } satisfies StopSelector;
}

const rateLimited = (retryAfter?: number) =>
  new SelectorError(
    "rate_limited",
    `Groq rate limit reached: Request too large ... OTPM | retry-after=${retryAfter ?? "-"} | remaining-requests=- | remaining-tokens=-`,
  );

let clock: ReturnType<typeof fakeClock>;

beforeEach(() => {
  clock = fakeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("FallbackStopSelector", () => {
  it("returns the primary's answer and never calls the secondary when the primary succeeds", async () => {
    const primary = selector(async () => response("llama"));
    const secondary = selector(async () => response("qwen"));
    const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

    const res = await s.selectStops(req, { timeoutMs: 9_000 });

    expect(res.model).toBe("llama");
    expect(primary.selectStops).toHaveBeenCalledTimes(1);
    expect(secondary.selectStops).not.toHaveBeenCalled();
    expect(s.isPrimaryCoolingDown()).toBe(false);
  });

  describe("falling back on 429", () => {
    it("retries the same request on the secondary when the primary is rate-limited", async () => {
      const repairReq: SelectionRequest = { ...req, repair: { previousRaw: "oops", prompt: "fix it" } };
      const primary = selector(async () => { throw rateLimited(); });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now, primaryName: "gpt-oss", secondaryName: "qwen" });

      const res = await s.selectStops(repairReq, { timeoutMs: 9_000 });

      expect(res.model).toBe("qwen");
      expect(secondary.selectStops).toHaveBeenCalledTimes(1);
      // Same request object (including the repair turn) is forwarded unchanged.
      expect(secondary.selectStops.mock.calls[0][0]).toBe(repairReq);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("gpt-oss rate-limited; retrying on qwen"));
    });

    it("gives the secondary only the time left in this attempt", async () => {
      const primary = selector(async () => { clock.advance(3_000); throw rateLimited(); });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await s.selectStops(req, { timeoutMs: 9_000 });

      expect(secondary.selectStops.mock.calls[0][1]).toMatchObject({ timeoutMs: 6_000 });
    });

    it("forwards the abort signal to the secondary", async () => {
      const controller = new AbortController();
      const primary = selector(async () => { throw rateLimited(); });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await s.selectStops(req, { timeoutMs: 9_000, signal: controller.signal });

      expect(secondary.selectStops.mock.calls[0][1].signal).toBe(controller.signal);
    });

    it("propagates the secondary's own error when the fallback also fails", async () => {
      const secondaryErr = new SelectorError("rate_limited", "qwen also limited");
      const primary = selector(async () => { throw rateLimited(); });
      const secondary = selector(async () => { throw secondaryErr; });
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await expect(s.selectStops(req, { timeoutMs: 9_000 })).rejects.toBe(secondaryErr);
    });
  });

  describe("passing other errors through", () => {
    const passthrough: Array<[string, unknown]> = [
      ["timeout", new SelectorError("timeout", "Groq request timed out")],
      ["aborted", new SelectorError("aborted", "Groq request was aborted")],
      ["http", new SelectorError("http", "Groq API error 500")],
      ["parse", new SelectorError("parse", "Response is not valid JSON", "{bad")],
      ["non-SelectorError", new TypeError("bug in our code")],
    ];

    it.each(passthrough)("rethrows a %s error without calling the secondary or starting a cooldown", async (_name, error) => {
      const primary = selector(async () => { throw error; });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await expect(s.selectStops(req, { timeoutMs: 9_000 })).rejects.toBe(error);
      expect(secondary.selectStops).not.toHaveBeenCalled();
      expect(s.isPrimaryCoolingDown()).toBe(false);
    });
  });

  describe("cooldown", () => {
    it("skips the primary for later requests during the cooldown, then tries it again", async () => {
      let primaryLimited = true;
      const primary = selector(async () => {
        if (primaryLimited) throw rateLimited(20);
        return response("llama");
      });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await s.selectStops(req, { timeoutMs: 9_000 }); // 429 -> falls back, cooldown 20s
      expect(s.isPrimaryCoolingDown()).toBe(true);

      clock.advance(19_000);
      const during = await s.selectStops(req, { timeoutMs: 9_000 });
      expect(during.model).toBe("qwen");
      expect(primary.selectStops).toHaveBeenCalledTimes(1); // not retried during cooldown
      // During the cooldown the secondary gets the full attempt timeout.
      expect(secondary.selectStops.mock.calls[1][1]).toMatchObject({ timeoutMs: 9_000 });

      primaryLimited = false;
      clock.advance(1_000); // exactly at the end of the cooldown
      expect(s.isPrimaryCoolingDown()).toBe(false);
      const after = await s.selectStops(req, { timeoutMs: 9_000 });
      expect(after.model).toBe("llama");
      expect(primary.selectStops).toHaveBeenCalledTimes(2);
    });

    it("is shared by every caller of the same instance (module-scope singleton in route.ts)", async () => {
      const primary = selector(async () => { throw rateLimited(30); });
      const secondary = selector(async () => response("qwen"));
      const shared = new FallbackStopSelector(primary, secondary, { now: clock.now });

      // Two concurrent "requests" after the cooldown has started.
      await shared.selectStops(req, { timeoutMs: 9_000 });
      await Promise.all([
        shared.selectStops(req, { timeoutMs: 9_000 }),
        shared.selectStops(req, { timeoutMs: 9_000 }),
      ]);

      expect(primary.selectStops).toHaveBeenCalledTimes(1);
      expect(secondary.selectStops).toHaveBeenCalledTimes(3);
    });

    it("still starts the cooldown when it gives up on the fallback", async () => {
      const primary = selector(async () => { clock.advance(8_000); throw rateLimited(); });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await expect(s.selectStops(req, { timeoutMs: 9_000 })).rejects.toMatchObject({ kind: "rate_limited" });
      expect(s.isPrimaryCoolingDown()).toBe(true);
    });
  });

  describe("giving up on timeout", () => {
    it("rethrows the 429 instead of starting a secondary call with too little time left", async () => {
      const err = rateLimited();
      // Leaves MIN_SECONDARY_MS - 1 ms: just under the threshold.
      const primary = selector(async () => { clock.advance(9_000 - MIN_SECONDARY_MS + 1); throw err; });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await expect(s.selectStops(req, { timeoutMs: 9_000 })).rejects.toBe(err);
      expect(secondary.selectStops).not.toHaveBeenCalled();
    });

    it("still falls back with exactly MIN_SECONDARY_MS left", async () => {
      const primary = selector(async () => { clock.advance(9_000 - MIN_SECONDARY_MS); throw rateLimited(); });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await s.selectStops(req, { timeoutMs: 9_000 });
      expect(secondary.selectStops.mock.calls[0][1]).toMatchObject({ timeoutMs: MIN_SECONDARY_MS });
    });

    it("does not fall back when the request was aborted (client disconnected)", async () => {
      const controller = new AbortController();
      const err = rateLimited();
      const primary = selector(async () => { controller.abort(); throw err; });
      const secondary = selector(async () => response("qwen"));
      const s = new FallbackStopSelector(primary, secondary, { now: clock.now });

      await expect(s.selectStops(req, { timeoutMs: 9_000, signal: controller.signal })).rejects.toBe(err);
      expect(secondary.selectStops).not.toHaveBeenCalled();
    });
  });
});

describe("cooldownMs", () => {
  it("uses Groq's retry-after seconds, including fractions", () => {
    expect(cooldownMs("... | retry-after=17 | ...")).toBe(17_000);
    expect(cooldownMs("... | retry-after=2.5 | ...")).toBe(2_500);
  });

  it("defaults to one minute when retry-after is missing or invalid", () => {
    expect(cooldownMs("Groq rate limit reached")).toBe(DEFAULT_COOLDOWN_MS);
    expect(cooldownMs("... | retry-after=- | ...")).toBe(DEFAULT_COOLDOWN_MS);
    expect(cooldownMs("... | retry-after=0 | ...")).toBe(DEFAULT_COOLDOWN_MS);
  });

  it("caps very long retry-after values", () => {
    expect(cooldownMs("... | retry-after=86400 | ...")).toBe(MAX_COOLDOWN_MS);
  });
});
