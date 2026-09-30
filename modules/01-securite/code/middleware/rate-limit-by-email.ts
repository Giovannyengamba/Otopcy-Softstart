/**
 * Per-email rate limit + brute-force lockout for auth endpoints.
 *
 * Why this matters: a global IP rate limit doesn't stop credential stuffing
 * across distributed proxies that all target the same email — each proxy
 * gets its own IP bucket, but the email's account stays under siege.
 *
 * Per-email buckets close that gap: regardless of source IP, an attacker
 * gets at most N attempts per email per window. When the email is missing
 * (parse failure, malformed body) we fall back to the IP key so the limiter
 * still rejects something.
 *
 * Backed by Upstash Redis when available, in-memory otherwise (with a
 * warning on the boot path — matches the parent IP limiter behaviour).
 *
 * WR-07 — On Vercel each serverless instance has its own memory, so the
 * in-memory fallback is effectively bypassed by an attacker spreading load
 * across instances. Two safeguards:
 *   - Module-load `log.warn` makes the fallback observable in logs.
 *   - `AUTH_RATE_LIMIT_FAIL_CLOSED=1` makes `check()` return 503 when redis
 *     is absent. Set this in production to prevent accidental deploy of a
 *     binary without UPSTASH configured.
 *
 * Usage from a Next.js route handler:
 *   const limiter = createEmailLimiter({ redis }, { bucket: 'auth:login', windowMs, max, code, message });
 *   const fail = await limiter.check(req, body.email ?? null);
 *   if (fail) return fail;
 */
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Redis } from '@upstash/redis';
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  type RateLimitStore,
} from '../rate-limit-store';
import { log } from '../observability/log';

export interface CreateEmailLimiterDeps {
  redis?: Redis;
}

export interface EmailLimiterConfig {
  bucket: string;
  windowMs: number;
  max: number;
  /** Stable error code returned in the 429 body (e.g. "TOO_MANY_LOGIN_ATTEMPTS"). */
  code: string;
  /** Human-readable message. */
  message: string;
}

export interface EmailLimiter {
  check(req: NextRequest, email: string | null): Promise<NextResponse | null>;
  /**
   * Refund a hit — call after a successful login when you don't want the
   * success to "burn" an attempt. Mirrors `skipSuccessfulRequests` from the
   * Express version.
   */
  refund(req: NextRequest, email: string | null): Promise<void>;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

function bucketKey(email: string | null, req: NextRequest): string {
  if (email && email.length > 0) return `e:${email.trim().toLowerCase()}`;
  return `ip:${clientIp(req)}`;
}

export function createEmailLimiter(
  deps: CreateEmailLimiterDeps,
  config: EmailLimiterConfig,
): EmailLimiter {
  // WR-07 — fail-closed in prod when redis is absent (env-controlled).
  // When set, `check()` returns 503 instead of silently using the in-memory
  // fallback, which would let an attacker spread load across instances.
  const failClosed = process.env.AUTH_RATE_LIMIT_FAIL_CLOSED === '1';

  if (!deps.redis) {
    // WR-07 — surface the degraded mode in logs so it's not silent.
    log.warn(
      `email-limiter using in-memory fallback (Redis absent) bucket=${config.bucket} ` +
        `failClosed=${failClosed ? '1' : '0'}`,
    );
  }

  const store: RateLimitStore = deps.redis
    ? new RedisRateLimitStore({
        redis: deps.redis,
        prefix: `rl:${config.bucket}:`,
        windowMs: config.windowMs,
      })
    : new MemoryRateLimitStore({ windowMs: config.windowMs });

  return {
    async check(req, email) {
      // WR-07 — fail-closed: when configured AND redis is absent, refuse
      // requests rather than rely on the per-instance memory fallback.
      if (failClosed && !deps.redis) {
        return NextResponse.json(
          {
            error: 'RATE_LIMIT_UNAVAILABLE',
            message: 'Rate limiter unavailable. Try again shortly.',
          },
          {
            status: 503,
            headers: { 'Retry-After': '30' },
          },
        );
      }
      const key = bucketKey(email, req);
      const { totalHits, resetTime } = await store.increment(key);
      if (totalHits > config.max) {
        const retryAfter = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
        return NextResponse.json(
          { error: config.code, message: config.message },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(config.max),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(resetTime.getTime() / 1000)),
            },
          },
        );
      }
      return null;
    },
    async refund(req, email) {
      const key = bucketKey(email, req);
      await store.decrement(key);
    },
  };
}
