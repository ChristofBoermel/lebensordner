import { NextRequest, NextResponse } from 'next/server'
import { emitStructuredError } from '@/lib/errors/structured-logger'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const allowedErrorTypes = ['client', 'unhandled_rejection']
    const error_type = allowedErrorTypes.includes(body.error_type) ? body.error_type : 'client'
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : undefined

    emitStructuredError({
      error_type,
      error_message: body.error_message,
      error_id: body.error_id,
      stack: body.component_stack,
      endpoint,
    })

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: false }, { status: 400 })
  }
}
