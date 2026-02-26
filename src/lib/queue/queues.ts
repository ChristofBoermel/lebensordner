import { Queue } from 'bullmq'
import { redisConnection } from './connection'

export const reminderQueue = new Queue('reminders', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})

export const emailQueue = new Queue('emails', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})

export const cleanupQueue = new Queue('cleanup', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
})
