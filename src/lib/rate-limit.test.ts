import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "./rate-limit";

function limiterAt(start = 0, options = { capacity: 3, refillPerSecond: 1 }) {
  let now = start;
  const limiter = new TokenBucketLimiter({ ...options, now: () => now });
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe("TokenBucketLimiter", () => {
  it("allows a burst up to capacity, then blocks", () => {
    const { limiter } = limiterAt();
    expect([1, 2, 3].map(() => limiter.take("u").ok)).toEqual([true, true, true]);
    const blocked = limiter.take("u");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("refills over time", () => {
    const { limiter, advance } = limiterAt();
    for (let i = 0; i < 3; i++) limiter.take("u");
    advance(1500);
    expect(limiter.take("u")).toMatchObject({ ok: true, remaining: 0 });
    expect(limiter.take("u").ok).toBe(false);
  });

  it("never refills past capacity", () => {
    const { limiter, advance } = limiterAt();
    advance(60_000);
    expect(limiter.take("u").remaining).toBe(2);
  });

  it("keeps separate buckets per key", () => {
    const { limiter } = limiterAt();
    for (let i = 0; i < 3; i++) limiter.take("a");
    expect(limiter.take("a").ok).toBe(false);
    expect(limiter.take("b").ok).toBe(true);
  });

  it("supports weighted costs", () => {
    const { limiter } = limiterAt();
    expect(limiter.take("u", 3).ok).toBe(true);
    expect(limiter.take("u", 1).ok).toBe(false);
  });

  it("prunes idle buckets once it grows past maxKeys", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 2, now: () => now });
    limiter.take("a");
    limiter.take("b");
    now += 10_000;
    limiter.take("c"); // a and b are full again and get pruned
    const size = (limiter as unknown as { buckets: Map<string, unknown> }).buckets.size;
    expect(size).toBe(1);
  });
});
