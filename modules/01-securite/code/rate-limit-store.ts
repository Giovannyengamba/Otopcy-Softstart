import 'server-only';
import type { Redis } from '@upstash/redis';

export interface IncrementResponse {
  totalHits: number;
  resetTime: Date;
}

/**
 * Minimal store interface — same shape as express-rate-limit's, kept so
 * existing tests / callers don't change. We dropped the `implements Store`
 * declaration since express-rate-limit isn't a dep in the monolith.
 */
export interface RateLimitStore {
  increment(key: string): Promise<IncrementResponse>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

export interface RedisRateLimitStoreOptions {
  redis: Redis;
  prefix?: string;
  windowMs: number;
}

export class RedisRateLimitStore implements RateLimitStore {
  readonly prefix: string;
  readonly windowMs: number;
  private readonly redis: Redis;

  constructor(options: RedisRateLimitStoreOptions) {
    this.redis = options.redis;
    this.prefix = options.prefix ?? 'rl:';
    this.windowMs = options.windowMs;
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const fullKey = this.k(key);
    const totalHits = (await this.redis.incr(fullKey)) as number;
    if (totalHits === 1) {
      await this.redis.expire(fullKey, Math.ceil(this.windowMs / 1000));
    }
    return {
      totalHits,
      resetTime: new Date(Date.now() + this.windowMs),
    };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.k(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.k(key));
  }
}

/**
 * In-memory fallback for dev when Redis is absent. NOT multi-instance safe —
 * a `logger.warn` should fire at boot when this is selected (caller's job).
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly windowMs: number;
  private readonly buckets = new Map<string, { hits: number; resetAt: number }>();

  constructor(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { hits: 1, resetAt });
      return { totalHits: 1, resetTime: new Date(resetAt) };
    }
    existing.hits += 1;
    return { totalHits: existing.hits, resetTime: new Date(existing.resetAt) };
  }

  async decrement(key: string): Promise<void> {
    const existing = this.buckets.get(key);
    if (existing && existing.hits > 0) existing.hits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}
