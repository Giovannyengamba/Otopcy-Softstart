type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const DEFAULT_REDACT_KEYS = [
  'email',
  'phone',
  'orderRef',
  'externalId',
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'csrfToken',
];

/**
 * Logger configuration.
 *
 * **Note**: redaction is shallow — only top-level keys of `ctx` are checked
 * against `redactKeys`. Nested objects are not recursively walked. If you
 * log nested PII like `{ user: { email: 'x' } }`, flatten the ctx first or
 * pre-redact upstream.
 */
export interface CreateLoggerOptions {
  env?: 'production' | 'development' | 'test';
  redactKeys?: readonly string[];
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

const KNOWN_ENVS = new Set(['production', 'development', 'test']);
function resolveEnv(
  explicit: CreateLoggerOptions['env'] | undefined,
): 'production' | 'development' | 'test' {
  if (explicit) return explicit;
  const fromProcess = process.env.NODE_ENV;
  if (fromProcess && KNOWN_ENVS.has(fromProcess))
    return fromProcess as 'production' | 'development' | 'test';
  // Unknown NODE_ENV (e.g., "staging") → assume production for fail-safe redaction.
  // Caller can pass env: 'development' explicitly during local work.
  return fromProcess ? 'production' : 'development';
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const env = resolveEnv(options.env);
  const redactKeys = new Set([...DEFAULT_REDACT_KEYS, ...(options.redactKeys ?? [])]);

  function redact(ctx: Record<string, unknown>): Record<string, unknown> {
    if (env !== 'production') return ctx;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(ctx)) {
      result[key] = redactKeys.has(key) ? '[REDACTED]' : value;
    }
    return result;
  }

  function emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      msg,
      ...(ctx ? redact(ctx) : {}),
    };
    let out: string;
    try {
      out =
        env === 'production'
          ? JSON.stringify(payload)
          : `[${level}] ${msg} ${ctx ? JSON.stringify(ctx) : ''}`.trim();
    } catch {
      // Fallback when ctx contains circular refs or non-serializable values.
      // A logger must never throw and crash the caller.
      out =
        env === 'production'
          ? JSON.stringify({
              timestamp: payload.timestamp,
              level,
              msg,
              _serializeError: true,
            })
          : `[${level}] ${msg} [unserializable ctx]`;
    }
    if (level === 'error') {
      console.error(out);
    } else {
      console.log(out);
    }
  }

  return {
    debug: (msg, ctx) => emit('debug', msg, ctx),
    info: (msg, ctx) => emit('info', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    error: (msg, ctx) => emit('error', msg, ctx),
  };
}
