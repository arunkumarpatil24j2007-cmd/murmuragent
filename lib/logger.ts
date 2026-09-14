// lib/logger.ts — Structured logging utility
// Redacts sensitive values. Never logs secrets.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACT_PATTERNS = [
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
];

function shouldRedact(key: string): boolean {
  return REDACT_PATTERNS.some((p) => p.test(key));
}

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (shouldRedact(key) && typeof value === 'string') {
      result[key] = value.slice(0, 4) + '***';
    } else {
      result[key] = sanitize(value);
    }
  }
  return result;
}

function formatMessage(level: LogLevel, component: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [${component}]`;
  if (data !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(sanitize(data))}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(component: string, message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', component, message, data));
    }
  },
  info(component: string, message: string, data?: unknown) {
    console.info(formatMessage('info', component, message, data));
  },
  warn(component: string, message: string, data?: unknown) {
    console.warn(formatMessage('warn', component, message, data));
  },
  error(component: string, message: string, data?: unknown) {
    console.error(formatMessage('error', component, message, data));
  },
};
