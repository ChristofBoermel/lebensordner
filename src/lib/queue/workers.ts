import { Worker } from 'bullmq'
import { redisConnection } from './connection'

let workersStarted = false

export function startWorkers() {
  if (workersStarted) return
  workersStarted = true

  // Reminder worker — processes daily reminder jobs
  const reminderWorker = new Worker(
    'reminders',
    async (job) => {
      console.log(`[Worker] Processing reminder job: ${job.name}`)
      try {
        // Call the existing cron endpoint internally
        const response = await fetch(
          `http://localhost:${process.env.PORT || 3000}/api/cron/send-reminders`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
          }
        )
        if (!response.ok) {
          throw new Error(`Reminder cron returned ${response.status}`)
        }
        const result = await response.json()
        console.log(`[Worker] Reminder job completed:`, result)
      } catch (error) {
        console.error(`[Worker] Reminder job failed:`, error)
        throw error
      }
    },
    { connection: redisConnection, concurrency: 1 }
  )

  // Email worker — processes email queue and upgrade emails
  const emailWorker = new Worker(
    'emails',
    async (job) => {
      console.log(`[Worker] Processing email job: ${job.name}`)
      try {
        let endpoint: string
        if (job.name === 'send-upgrade-emails') {
          endpoint = '/api/cron/send-upgrade-emails'
        } else if (job.name === 'process-email-queue') {
          endpoint = '/api/cron/process-email-queue'
        } else {
          console.warn(`[Worker] Unknown email job: ${job.name}`)
          return
        }

        const response = await fetch(
          `http://localhost:${process.env.PORT || 3000}${endpoint}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
          }
        )
        if (!response.ok) {
          throw new Error(`Email cron ${endpoint} returned ${response.status}`)
        }
        const result = await response.json()
        console.log(`[Worker] Email job ${job.name} completed:`, result)
      } catch (error) {
        console.error(`[Worker] Email job ${job.name} failed:`, error)
        throw error
      }
    },
    { connection: redisConnection, concurrency: 2 }
  )

  // Cleanup worker — handles expired data cleanup
  const cleanupWorker = new Worker(
    'cleanup',
    async (job) => {
      console.log(`[Worker] Processing cleanup job: ${job.name}`)
      // Cleanup logic can be added here later
      // For now, this is a placeholder for expired token cleanup, etc.
      console.log(`[Worker] Cleanup job completed`)
    },
    { connection: redisConnection, concurrency: 1 }
  )

  // Error handlers
  for (const worker of [reminderWorker, emailWorker, cleanupWorker]) {
    worker.on('failed', (job, err) => {
      console.error(`[Worker] Job ${job?.name} failed:`, err.message)
    })
    worker.on('completed', (job) => {
      console.log(`[Worker] Job ${job.name} completed`)
    })
  }

  console.log('[Worker] All workers started')
}
