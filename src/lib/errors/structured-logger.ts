type StructuredLogLevel = 'error' | 'warn' | 'info'

interface StructuredLogParams {
  level: StructuredLogLevel
  event_type: string
  event_message: string
  endpoint?: string
  queue?: string
  event_id?: string
  stack?: string
  metadata?: Record<string, unknown>
}

interface StructuredErrorParams {
  error_type: string
  error_message: string
  endpoint?: string
  queue?: string
  error_id?: string
  stack?: string
}

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_WARN_MAX_PER_WINDOW = 40
const DEFAULT_INFO_MAX_PER_WINDOW = 120

const SENSITIVE_KEY_PATTERN = /(password|token|secret|apikey|api_key|authorization|cookie|session|key|jwt|bearer)/i
const SENSITIVE_VALUE_PATTERN = /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}|Bearer\s+[A-Za-z0-9._-]{10,}|sk_(live|test)_[A-Za-z0-9]{10,}|[A-Za-z0-9]{32,})/i

type RateLimitState = {
  windowStart: number
  count: number
  suppressed: number
}

const rateLimitState = new Map<string, RateLimitState>()

function getWarnLimit(): number {
  const value = Number(process.env.LOG_WARN_MAX_PER_MINUTE)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_WARN_MAX_PER_WINDOW
}

function getInfoLimit(): number {
  const value = Number(process.env.LOG_INFO_MAX_PER_MINUTE)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INFO_MAX_PER_WINDOW
}

function getWindowMs(): number {
  const value = Number(process.env.LOG_RATE_LIMIT_WINDOW_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_WINDOW_MS
}

function sanitizeMessage(value: string): string {
  return value.replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]')
}

function redactMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[REDACTED_DEPTH_LIMIT]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return sanitizeMessage(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((entry) => redactMetadata(entry, depth + 1))
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const redacted: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(obj)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        redacted[key] = '[REDACTED]'
      } else {
        redacted[key] = redactMetadata(entry, depth + 1)
      }
    }
    return redacted
  }
  return '[REDACTED_UNSUPPORTED]'
}

function writeLog(payload: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(payload) + '\n')
}

function tryConsumeRateLimit(level: StructuredLogLevel, fingerprint: string): boolean {
  if (level === 'error') return true

  const now = Date.now()
  const windowMs = getWindowMs()
  const max = level === 'warn' ? getWarnLimit() : getInfoLimit()
  const state = rateLimitState.get(fingerprint)

  if (!state) {
    rateLimitState.set(fingerprint, { windowStart: now, count: 1, suppressed: 0 })
    return true
  }

  if (now - state.windowStart >= windowMs) {
    if (state.suppressed > 0) {
      writeLog({
        level: 'info',
        error_type: 'logging',
        error_message: `Suppressed ${state.suppressed} ${level} log events in previous window`,
        metadata: { fingerprint },
        error_id: `EVT-${now}`,
        timestamp: new Date().toISOString(),
      })
    }
    rateLimitState.set(fingerprint, { windowStart: now, count: 1, suppressed: 0 })
    return true
  }

  if (state.count < max) {
    state.count += 1
    return true
  }

  state.suppressed += 1
  return false
}

export function emitStructuredLog(params: StructuredLogParams): void {
  const { level, event_type, event_message, endpoint, queue, event_id, stack, metadata } = params

  const fingerprint = `${level}:${event_type}:${endpoint ?? ''}`
  if (!tryConsumeRateLimit(level, fingerprint)) {
    return
  }

  const event_id_final = event_id ?? `EVT-${Date.now()}`
  const timestamp = new Date().toISOString()

  const optionalFields: Record<string, unknown> = {}
  if (endpoint !== undefined) optionalFields.endpoint = endpoint
  if (queue !== undefined) optionalFields.queue = queue
  if (stack !== undefined) optionalFields.stack = stack.split('\n').slice(0, 3).join('\n')
  if (metadata !== undefined) optionalFields.metadata = redactMetadata(metadata)

  writeLog({
    level,
    error_type: event_type,
    error_message: sanitizeMessage(event_message),
    ...optionalFields,
    error_id: event_id_final,
    timestamp,
  })
}

export function emitStructuredError(params: StructuredErrorParams): void {
  const { error_type, error_message, endpoint, queue, error_id, stack } = params

  emitStructuredLog({
    level: 'error',
    event_type: error_type,
    event_message: error_message,
    endpoint,
    queue,
    event_id: error_id,
    stack,
  })
}

export function emitStructuredWarn(params: Omit<StructuredLogParams, 'level'>): void {
  emitStructuredLog({
    ...params,
    level: 'warn',
  })
}

export function emitStructuredInfo(params: Omit<StructuredLogParams, 'level'>): void {
  emitStructuredLog({
    ...params,
    level: 'info',
  })
}
