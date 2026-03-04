import { NextResponse } from 'next/server'
/**
 * Passkey rollout is postponed; keep API response non-enumerating.
 */
export async function GET() {
  return NextResponse.json({ hasPasskey: false })
}
