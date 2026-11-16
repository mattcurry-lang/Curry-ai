import type { LogLevel } from './config.ts'

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const SENSITIVE_KEY = /(authorization|api[-_]?key|secret|token|password|cookie|service[-_]?role|bearer)/i
const MAX_DEPTH = 5

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]'
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (value instanceof Error) return { name: value.name, message: value.message }
  if (value !== null && typeof value === 'object') {
    // Objects with a custom toJSON (e.g. Secret) serialise themselves safely.
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return (value as { toJSON(): unknown }).toJSON()
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1)
    return out
  }
  return value
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export function createLogger(
  level: LogLevel,
  sink: (line: string) => void = (line) => process.stdout.write(line + '\n'),
): Logger {
  const emit = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) return
    const safe = fields ? (redact(fields) as Record<string, unknown>) : {}
    sink(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...safe }))
  }
  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
  }
}
