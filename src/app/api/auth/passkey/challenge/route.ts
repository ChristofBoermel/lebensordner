import { NextResponse } from 'next/server'
/**
 * Passkey rollout is postponed.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Passkey login is currently unavailable.' },
    { status: 501 }
  )
}
