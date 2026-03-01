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

export function emitStructuredLog(params: StructuredLogParams): void {
  const { level, event_type, event_message, endpoint, queue, event_id, stack, metadata } = params

  const event_id_final = event_id ?? `EVT-${Date.now()}`
  const timestamp = new Date().toISOString()

  const optionalFields: Record<string, unknown> = {}
  if (endpoint !== undefined) optionalFields.endpoint = endpoint
  if (queue !== undefined) optionalFields.queue = queue
  if (stack !== undefined) optionalFields.stack = stack.split('\n').slice(0, 3).join('\n')
  if (metadata !== undefined) optionalFields.metadata = metadata

  process.stdout.write(
    JSON.stringify({
      level,
      error_type: event_type,
      error_message: event_message,
      ...optionalFields,
      error_id: event_id_final,
      timestamp,
    }) + '\n'
  )
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
