import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.error('[Client Error Report]', {
      error_id: body.error_id,
      error_message: body.error_message,
      component_stack: body.component_stack,
      user_agent: body.user_agent,
      timestamp: body.timestamp,
      reported_at: new Date().toISOString(),
    })

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: false }, { status: 400 })
  }
}
