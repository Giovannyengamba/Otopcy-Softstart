/**
 * Generic, dependency-free circuit breaker.
 *
 * State machine:
 *
 *   CLOSED      → [N failures within windowMs]  → OPEN
 *   OPEN        → [cooldownMs elapsed]          → HALF_OPEN  (next call probes)
 *   HALF_OPEN   → [1 success]                   → CLOSED
 *   HALF_OPEN   → [1 failure]                   → OPEN       (cooldown resets)
 *
 * Use it to short-circuit calls to flaky upstream services so we stop
 * burning quota / RPC budget when they're down.
 *
 * SCALING NOTE — single instance only.
 *   The state lives in the Node process memory. It does NOT survive a
 *   restart and is NOT shared across instances. If you horizontally scale,
 *   swap the in-memory state for an Upstash-backed counter (windowed INCR
 *   + TTL key) — the public API of this class should stay unchanged.
 */

export interface CircuitBreakerOptions {
  /** Failures within `windowMs` to trip OPEN. Default 5. */
  failureThreshold?: number;
  /** Rolling failure window in ms. Default 30 000. */
  windowMs?: number;
  /** OPEN→HALF_OPEN cooldown in ms. Default 60 000. */
  cooldownMs?: number;
  /** For logs + the CircuitOpenError message. */
  name: string;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitOpenError extends Error {
  /** Wall-clock time at which the breaker will allow a probe again. */
  readonly retryAt: Date;
  constructor(name: string, retryAt: Date) {
    super(`Circuit "${name}" is open. Retry at ${retryAt.toISOString()}.`);
    this.name = 'CircuitOpenError';
    this.retryAt = retryAt;
  }
}

interface InternalState {
  failures: number[]; // unix-ms timestamps of recent failures
  openedAt: number | null;
  /** True once we've moved into half-open and a probe is in flight. */
  probeInFlight: boolean;
}

export class CircuitBreaker {
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly s: InternalState = {
    failures: [],
    openedAt: null,
    probeInFlight: false,
  };

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.windowMs = opts.windowMs ?? 30_000;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
  }

  /**
   * Wrap an async call. Throws `CircuitOpenError` synchronously if the
   * breaker is open and the cooldown hasn't elapsed.
   *
   * Notes on half-open:
   *   - The first call after cooldown is the probe. We allow it through
   *     and record the result.
   *   - If a *second* call arrives while the probe is in flight, we treat
   *     it as still-open (single-flight half-open). This avoids a thundering
   *     herd in front of a recovering upstream.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.state();
    if (state === 'open') {
      throw new CircuitOpenError(this.name, this.retryAt());
    }
    if (state === 'half-open') {
      if (this.s.probeInFlight) {
        throw new CircuitOpenError(this.name, this.retryAt());
      }
      this.s.probeInFlight = true;
      try {
        const out = await fn();
        // Probe succeeded — fully reset.
        this.reset();
        return out;
      } catch (err) {
        // Probe failed — re-open with a fresh cooldown.
        this.s.openedAt = Date.now();
        this.s.failures = [Date.now()];
        this.s.probeInFlight = false;
        throw err;
      }
    }

    // CLOSED path.
    try {
      return await fn();
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  /**
   * Read the current state without side-effects.
   */
  state(): CircuitState {
    if (this.s.openedAt === null) return 'closed';
    if (Date.now() - this.s.openedAt >= this.cooldownMs) return 'half-open';
    return 'open';
  }

  /**
   * The earliest wall-clock time at which a probe will be allowed.
   * Useful for `Retry-After` headers. For closed state returns now.
   */
  retryAt(): Date {
    if (this.s.openedAt === null) return new Date();
    return new Date(this.s.openedAt + this.cooldownMs);
  }

  /** Force back to CLOSED — fully clears recent-failure history. */
  reset(): void {
    this.s.failures = [];
    this.s.openedAt = null;
    this.s.probeInFlight = false;
  }

  // ── Internals ──────────────────────────────────────────────────────

  private recordFailure(): void {
    const now = Date.now();
    this.s.failures = this.s.failures.filter((t) => now - t < this.windowMs);
    this.s.failures.push(now);
    if (this.s.failures.length >= this.failureThreshold) {
      this.s.openedAt = now;
    }
  }
}
