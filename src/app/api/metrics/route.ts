import { reminderQueue, emailQueue, cleanupQueue } from '@/lib/queue/queues'

const METRICS_SECRET = process.env.METRICS_SECRET

export async function GET(request: Request): Promise<Response> {
  if (!METRICS_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${METRICS_SECRET}`) {
    return new Response('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  }

  const [reminderCounts, emailCounts, cleanupCounts] = await Promise.all([
    reminderQueue.getJobCounts(),
    emailQueue.getJobCounts(),
    cleanupQueue.getJobCounts(),
  ])

  const queues = [
    { name: 'reminders', counts: reminderCounts },
    { name: 'emails', counts: emailCounts },
    { name: 'cleanup', counts: cleanupCounts },
  ]

  const states = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const

  let body = ''

  for (const state of states) {
    body += `# HELP bullmq_jobs_${state} Number of BullMQ jobs in ${state} state\n`
    body += `# TYPE bullmq_jobs_${state} gauge\n`
    for (const queue of queues) {
      const value = queue.counts[state] ?? 0
      body += `bullmq_jobs_${state}{queue="${queue.name}"} ${value}\n`
    }
  }

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  })
}
