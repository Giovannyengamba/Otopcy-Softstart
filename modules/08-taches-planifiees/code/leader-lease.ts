/**
 * Redis-backed leader-election for cron ticks.
 *
 * Multiple replicas run the same setInterval loops. Without coordination
 * they each execute the same cron tick — wasted DB writes, double emails,
 * contention. This helper makes only one instance per `name` run a tick:
 *
 *   await withLease(redis, 'verification-cleanup', 60_000, async () => {
 *     await prisma.verificationCode.deleteMany(...);
 *   });
 *
 * Mechanism:
 *   SET cron:lease:<name> <holderId> NX EX <ttlSeconds>
 *
 *   - NX = only set if not exists (atomic via Upstash).
 *   - EX = auto-expires so a crashed leader's lock is released.
 *
 * If we got the lease, run fn(). On exit (success OR failure) we release
 * iff we still hold it (the holderId guard prevents releasing someone
 * else's lease in case ours had expired mid-fn).
 *
 * Pick `ttlMs` to comfortably exceed the expected fn() runtime. Too low =
 * two instances run in parallel; too high = if the leader crashes its
 * peers wait until expiry. Cron-tick scale: 30s for fast ticks, several
 * minutes for slow ones.
 *
 * No-Redis fallback: when `redis` is undefined (dev / no Upstash configured),
 * `withLease` just runs fn() unconditionally. That's correct for the
 * single-instance dev case the rest of the boilerplate already assumes.
 */
import type { Redis } from './redis';
import { randomBytes } from 'node:crypto';
import { createLogger } from './logger';

const logger = createLogger();

// One holder id per process — randomised at boot so two instances of the
// same image always pick different ids.
const HOLDER_ID = `holder_${randomBytes(8).toString('hex')}`;

export async function withLease(
  redis: Redis | undefined,
  name: string,
  ttlMs: number,
  fn: () => Promise<void>,
): Promise<void> {
  if (!redis) {
    // Dev / single-instance — no leasing needed.
    await fn();
    return;
  }

  const key = `cron:lease:${name}`;
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

  // Upstash overload: set(key, value, { nx: true, ex: ttlSeconds })
  const acquired = await redis.set(key, HOLDER_ID, {
    nx: true,
    ex: ttlSeconds,
  });
  if (acquired !== 'OK') {
    return; // someone else holds the lease this tick
  }

  try {
    await fn();
  } finally {
    // Release only if WE still hold it. Without the guard, if the lease
    // had expired mid-fn() and another instance grabbed it, our DEL would
    // steal their lease.
    try {
      const current = (await redis.get(key)) as string | null;
      if (current === HOLDER_ID) {
        await redis.del(key);
      }
    } catch (err) {
      logger.warn(`leader-lease: release failed for ${name}`, {
        err: String(err),
      });
    }
  }
}
