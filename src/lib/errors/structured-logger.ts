interface StructuredErrorParams {
  error_type: string
  error_message: string
  endpoint?: string
  queue?: string
  error_id?: string
  stack?: string
}

export function emitStructuredError(params: StructuredErrorParams): void {
  const { error_type, error_message, endpoint, queue, error_id, stack } = params

  const error_id_final = error_id ?? `ERR-${Date.now()}`
  const timestamp = new Date().toISOString()

  const optionalFields: Record<string, string> = {}
  if (endpoint !== undefined) optionalFields.endpoint = endpoint
  if (queue !== undefined) optionalFields.queue = queue
  if (stack !== undefined) optionalFields.stack = stack.split('\n').slice(0, 3).join('\n')

  process.stdout.write(
    JSON.stringify({
      level: 'error',
      error_type,
      error_message,
      ...optionalFields,
      error_id: error_id_final,
      timestamp,
    }) + '\n'
  )
}
