import { reminderQueue, emailQueue, cleanupQueue } from './queues'

export async function setupScheduledJobs() {
  // Remove existing repeatable jobs to avoid duplicates on restart
  const existingReminder = await reminderQueue.getRepeatableJobs()
  for (const job of existingReminder) {
    await reminderQueue.removeRepeatableByKey(job.key)
  }

  const existingEmail = await emailQueue.getRepeatableJobs()
  for (const job of existingEmail) {
    await emailQueue.removeRepeatableByKey(job.key)
  }

  const existingCleanup = await cleanupQueue.getRepeatableJobs()
  for (const job of existingCleanup) {
    await cleanupQueue.removeRepeatableByKey(job.key)
  }

  // Daily at 8:00 AM UTC — replaces vercel.json cron "0 8 * * *"
  await reminderQueue.add(
    'send-daily-reminders',
    {},
    { repeat: { pattern: '0 8 * * *' } }
  )

  // Daily at 10:00 AM UTC — replaces "0 10 * * *"
  await emailQueue.add(
    'send-upgrade-emails',
    {},
    { repeat: { pattern: '0 10 * * *' } }
  )

  // Every 15 minutes — replaces "0 9 * * *" with more frequent processing
  await emailQueue.add(
    'process-email-queue',
    {},
    { repeat: { pattern: '*/15 * * * *' } }
  )

  // Daily at 3:00 AM UTC — cleanup old data
  await cleanupQueue.add(
    'cleanup-expired',
    {},
    { repeat: { pattern: '0 3 * * *' } }
  )

  console.log('[Queue] Scheduled jobs registered')
}
