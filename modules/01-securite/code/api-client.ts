// Battle-tested fetch wrapper with auto-refresh on 401, CSRF auto, and
// idempotent-only network retry. Adapted from cagnottes-sn — generalized
// to use NEXT_PUBLIC_COOKIE_PREFIX (default "app").

import { API_URL, COOKIE_PREFIX } from './constants';

const CSRF_COOKIE_NAME = `${COOKIE_PREFIX}-csrf`;
const CSRF_STORAGE_KEY = `${COOKIE_PREFIX}-csrf`;

export const BACKEND_URL = API_URL;

function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem(CSRF_STORAGE_KEY);
  if (fromStorage) return fromStorage;
  const escaped = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export function storeCsrfToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CSRF_STORAGE_KEY, token);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax${secure}`;
}

export function clearCsrfToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CSRF_STORAGE_KEY);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CSRF_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

// Refresh token lock — prevent multiple simultaneous refresh calls.
let refreshPromise: Promise<boolean> | null = null;

const REFRESH_TIMEOUT_MS = 10_000;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as { csrfToken?: string };
        if (data.csrfToken) storeCsrfToken(data.csrfToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  baseUrl?: string;
  _isRetryAfterRefresh?: boolean;
}

/**
 * Stable backend error codes — the strings the backend returns in the
 * `error` field of a 4xx/5xx response body. Frontend code should switch
 * on `err.code` (string union below) rather than parsing `err.message`,
 * which is a translated user-facing string subject to change.
 *
 * Add new codes here as the backend grows them. Unknown codes from older
 * backends are still handled — `code` is widened to `string` at runtime.
 */
export type ApiErrorCode =
  // auth
  | 'TOO_MANY_LOGIN_ATTEMPTS'
  | 'TOO_MANY_RESET_REQUESTS'
  | 'TOO_MANY_VERIFY_ATTEMPTS'
  | 'TOO_MANY_RESET_ATTEMPTS'
  | 'TOO_MANY_SIGNUP_ATTEMPTS'
  // upload
  | 'INVALID_FILE_CONTENT'
  // withdrawals
  | 'AMOUNT_BELOW_MIN'
  | 'AMOUNT_ABOVE_MAX'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'COOLDOWN_ACTIVE'
  | 'PIN_NOT_SET'
  | 'PIN_REQUIRED'
  | 'PIN_INVALID'
  | 'INSUFFICIENT_BALANCE'
  | 'WITHDRAWAL_TX_FAILED'
  | 'USER_NOT_FOUND';

export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  /**
   * Stable error code from the backend's response body (`body.error`).
   * Use this for branching UI (e.g. `if (err.code === 'PIN_REQUIRED')`),
   * not the message string. Empty when the backend didn't return one
   * (e.g. network errors set status=0, code='').
   */
  readonly code: ApiErrorCode | (string & {}) | '';

  constructor(status: number, message: string, body?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.body = body || {};
    this.code = typeof body?.error === 'string' ? body.error : '';
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, baseUrl, _isRetryAfterRefresh = false } = options;
  const effectiveBaseUrl = baseUrl ?? API_URL;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (mutationMethods.includes(method.toUpperCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      fetchHeaders['x-csrf-token'] = csrfToken;
    }
  }

  // Audit 011 D-01: never retry non-idempotent verbs. A POST that succeeded
  // but lost its response would create a duplicate record.
  const isIdempotent = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
  const MAX_RETRIES = isIdempotent ? 1 : 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const init: RequestInit = {
        method,
        headers: fetchHeaders,
        credentials: 'include',
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      const response = await fetch(`${effectiveBaseUrl}${path}`, init);

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 && !_isRetryAfterRefresh && path !== '/api/auth/refresh') {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return api<T>(path, { ...options, _isRetryAfterRefresh: true });
          }
        }

        let errorMessage = `Error ${response.status}`;
        let errorBody: Record<string, unknown> = {};
        try {
          const text = await response.text();
          try {
            const json = JSON.parse(text);
            errorBody = json as Record<string, unknown>;
            errorMessage = (json as { error?: string }).error || errorMessage;
          } catch {
            errorMessage =
              response.status >= 500
                ? 'The server is temporarily unavailable'
                : `Error ${response.status}`;
          }
        } catch {
          // Could not read response body at all.
        }

        throw new ApiError(response.status, errorMessage, errorBody);
      }

      return response.json() as Promise<T>;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError || attempt >= MAX_RETRIES) {
        if (!(err instanceof ApiError)) {
          const isTimeout = err instanceof DOMException && err.name === 'AbortError';
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          const message = isTimeout
            ? 'The request timed out. Check your connection and try again.'
            : isOffline
              ? 'No internet connection. Check your network and try again.'
              : 'Network error. Please try again.';
          throw new ApiError(0, message);
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw lastError;
}
