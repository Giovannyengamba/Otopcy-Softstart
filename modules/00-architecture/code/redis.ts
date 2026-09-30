import 'server-only';
import { Redis } from '@upstash/redis';

export interface CreateRedisClientOptions {
  url?: string;
  token?: string;
}

export function createRedisClient(options: CreateRedisClientOptions = {}): Redis {
  const url = options.url ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = options.token ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'createRedisClient: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN (set env vars or pass options)',
    );
  }

  return new Redis({ url, token });
}

/**
 * Singleton Upstash client. Returns null when the env vars are absent so
 * callers can decide their fallback (e.g. MemoryRateLimitStore in dev,
 * fail-closed in prod). The client itself is HTTP-based, so there is no
 * connection lifecycle to manage.
 */
let _redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

/** Convenience export for callers that want a possibly-null redis client. */
export const redis: Redis | null = getRedis();

export type { Redis };
