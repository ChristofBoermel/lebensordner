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
      { name: 'reminders', counts: reminderCounts },
      { name: 'emails', counts: emailCounts },
      { name: 'cleanup', counts: cleanupCounts },
    ].map(({ name, counts }) => ({
      name,
      waiting: counts['waiting'] ?? 0,
      active: counts['active'] ?? 0,
      completed: counts['completed'] ?? 0,
      failed: counts['failed'] ?? 0,
      delayed: counts['delayed'] ?? 0,
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
