import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { reminderQueue, emailQueue, cleanupQueue } from '@/lib/queue/queues'

export async function GET() {
  try {
    await requireAdmin()

    const [reminderCounts, emailCounts, cleanupCounts] = await Promise.all([
      reminderQueue.getJobCounts(),
      emailQueue.getJobCounts(),
      cleanupQueue.getJobCounts(),
    ])

    const queues = [
      { name: 'reminders', ...reminderCounts },
      { name: 'emails', ...emailCounts },
      { name: 'cleanup', ...cleanupCounts },
    ].map(({ name, waiting, active, completed, failed, delayed }) => ({
      name,
      waiting: waiting ?? 0,
      active: active ?? 0,
      completed: completed ?? 0,
      failed: failed ?? 0,
      delayed: delayed ?? 0,
    }))

    return NextResponse.json({ queues })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (error.statusCode === 403) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin queues error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
