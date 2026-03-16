import { describe, it, expect, beforeEach } from "vitest";
import { cacheGet, cacheSet } from "./mem-cache";

beforeEach(() => {
  // Clear the module-level store by importing the real module fresh
  // We rely on cache TTL expiry for isolation between tests
});

describe("mem-cache", () => {
  it("set and get returns stored value", () => {
    cacheSet("key1", { name: "test" }, 60);
    expect(cacheGet("key1")).toEqual({ name: "test" });
  });

  it("get returns null for unknown key", () => {
    expect(cacheGet("missing-key-xyz")).toBeNull();
  });

  it("get returns null after TTL expires", async () => {
    cacheSet("expiring", "value", 0.001); // 1ms TTL
    await new Promise((r) => setTimeout(r, 5));
    expect(cacheGet("expiring")).toBeNull();
  });

  it("stores different types", () => {
    cacheSet("number", 42, 60);
    cacheSet("array", [1, 2, 3], 60);
    cacheSet("bool", true, 60);

    expect(cacheGet("number")).toBe(42);
    expect(cacheGet("array")).toEqual([1, 2, 3]);
    expect(cacheGet("bool")).toBe(true);
  });

  it("overwrites an existing key", () => {
    cacheSet("overwrite", "first", 60);
    cacheSet("overwrite", "second", 60);
    expect(cacheGet("overwrite")).toBe("second");
  });

  it("different keys are independent", () => {
    cacheSet("a", "alpha", 60);
    cacheSet("b", "beta", 60);
    expect(cacheGet("a")).toBe("alpha");
    expect(cacheGet("b")).toBe("beta");
  });
});
