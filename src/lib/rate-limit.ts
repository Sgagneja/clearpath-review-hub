/**
 * In-memory token bucket used to throttle mutations per user.
 *
 * Good enough for a single-region demo, but each serverless instance keeps its
 * own buckets, so a determined client spread across instances gets more than
 * the limit. Production would back this with Redis (e.g. Upstash Ratelimit) so
 * all instances share one counter.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** How long until one token is available again (0 when ok). */
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface TokenBucketOptions {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens restored per second. */
  refillPerSecond: number;
  now?: () => number;
  /** Buckets are pruned once the map grows past this many keys. */
  maxKeys?: number;
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(private readonly options: TokenBucketOptions) {
    this.now = options.now ?? Date.now;
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  take(key: string, cost = 1): RateLimitResult {
    const { capacity, refillPerSecond } = this.options;
    const now = this.now();
    const bucket = this.refill(this.buckets.get(key) ?? { tokens: capacity, updatedAt: now }, now);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.buckets.set(key, bucket);
      this.pruneIfNeeded(now);
      return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    this.buckets.set(key, bucket);
    const deficit = cost - bucket.tokens;
    return {
      ok: false,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: Math.ceil((deficit / refillPerSecond) * 1000),
    };
  }

  private refill(bucket: Bucket, now: number): Bucket {
    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
    return {
      tokens: Math.min(
        this.options.capacity,
        bucket.tokens + elapsedSeconds * this.options.refillPerSecond,
      ),
      updatedAt: now,
    };
  }

  /** Full buckets carry no state worth keeping, so they're safe to drop. */
  private pruneIfNeeded(now: number): void {
    if (this.buckets.size <= this.maxKeys) return;
    for (const [key, bucket] of this.buckets) {
      if (this.refill(bucket, now).tokens >= this.options.capacity) this.buckets.delete(key);
    }
  }
}
