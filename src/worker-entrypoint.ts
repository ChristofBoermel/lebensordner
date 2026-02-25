import { setupScheduledJobs } from './lib/queue/scheduler'
import { startWorkers } from './lib/queue/workers'

;(async () => {
  await setupScheduledJobs()
  const workers = startWorkers()

  const shutdown = async () => {
    console.log('[Worker] Shutting down...')
    await Promise.all(workers.map((w) => w.close()))
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
})()
