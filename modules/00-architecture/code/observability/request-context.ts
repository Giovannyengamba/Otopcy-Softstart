// Source: composed from D-12, D-14, and node:async_hooks documentation.
// No Next.js types imported — module is unit-testable without booting Next.
import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  requestId: string;
  startedAt: number;
}

const als = new AsyncLocalStorage<RequestContext>();

/**
 * Read X-Request-Id from inbound Headers, or mint a new one. Returns the
 * RequestContext but does NOT enter the ALS scope — call `withRequestContext`
 * for that, or use it from a route handler that wraps the entire body.
 *
 * Inbound IDs are validated against `/^[0-9a-f-]{8,64}$/i` to defend against
 * log-poisoning (a client cannot inject newlines or control characters).
 */
export function makeRequestContext(headers: Headers): RequestContext {
  const inbound = headers.get('x-request-id');
  const requestId = inbound && /^[0-9a-f-]{8,64}$/i.test(inbound) ? inbound : randomUUID();
  return { requestId, startedAt: Date.now() };
}

/**
 * Run `fn` inside an ALS scope carrying the given context. Use this in route
 * handlers — wrap the entire handler body so all downstream awaits see the
 * same context.
 */
export function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return als.run(ctx, fn);
}

/** Fetch the current request ID, or undefined if outside any context. */
export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

/** Fetch the entire current context, or undefined. */
export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}
