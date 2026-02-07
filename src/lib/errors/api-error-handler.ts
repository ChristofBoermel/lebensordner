import { NextRequest, NextResponse } from 'next/server'

/**
 * Custom API error class with HTTP status code support.
 * Use for operational errors that should return specific status codes to clients.
 */
export class ApiError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

// Common error instances
export class UnauthorizedError extends ApiError {
  constructor(message = 'Nicht autorisiert') {
    super(message, 401)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Zugriff verweigert') {
    super(message, 403)
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Nicht gefunden') {
    super(message, 404)
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Ungültige Eingabe') {
    super(message, 400)
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.') {
    super(message, 429)
  }
}

/**
 * Wraps an async API route handler with standardized error handling.
 * Catches errors, logs details server-side, and returns safe error responses to clients.
 *
 * @example
 * export const POST = withErrorHandler(async (req) => {
 *   const user = await getUser(req)
 *   if (!user) throw new UnauthorizedError()
 *   return NextResponse.json({ success: true })
 * })
 */
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      return await handler(req)
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        )
      }

      // Log full error details server-side only
      logError(error instanceof Error ? error : new Error(String(error)), {
        endpoint: req.nextUrl.pathname,
        method: req.method,
      })

      // Return generic message to client - never expose internals
      return NextResponse.json(
        { error: 'Ein interner Fehler ist aufgetreten' },
        { status: 500 }
      )
    }
  }
}

/**
 * Logs an error with contextual information for server-side debugging.
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  console.error('[API Error]', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context,
  })
}

/**
 * Converts an unknown error into a safe, user-facing error message.
 * Never exposes stack traces or internal details.
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Ein interner Fehler ist aufgetreten'
}
