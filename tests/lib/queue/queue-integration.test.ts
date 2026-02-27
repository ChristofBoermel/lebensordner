import { beforeEach, describe, expect, it, vi } from 'vitest'

type Job = { name: string }
type WorkerInstance = {
  queueName: string
  processor: (job: Job) => Promise<void>
  options: { connection: unknown; concurrency: number }
  on: ReturnType<typeof vi.fn>
}

const hoisted = vi.hoisted(() => ({
  workerInstances: [] as WorkerInstance[],
  workerCtor: vi.fn(),
  cleanupExpiredLimits: vi.fn(async () => 0),
}))

vi.mock('bullmq', () => ({
  Worker: function MockWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>,
    options: { connection: unknown; concurrency: number }
  ) {
    const instance: WorkerInstance = {
      queueName,
      processor,
      options,
      on: vi.fn(),
    }
    hoisted.workerInstances.push(instance)
    hoisted.workerCtor(queueName, processor, options)
    return instance
  },
}))

vi.mock('@/lib/queue/connection', () => ({
  redisConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('@/lib/security/rate-limit', () => ({
  cleanupExpiredLimits: hoisted.cleanupExpiredLimits,
}))

async function loadWorkersModule() {
  vi.resetModules()
  hoisted.workerInstances.length = 0
  hoisted.workerCtor.mockClear()
  hoisted.cleanupExpiredLimits.mockClear()
  process.env.CRON_SECRET = 'test-cron-secret'
  process.env.NEXTJS_INTERNAL_URL = 'http://nextjs:3000'
  return import('@/lib/queue/workers')
}

describe('Queue Workers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
    ) as unknown as typeof fetch
  })

  it('starts reminder, email and cleanup workers with expected concurrency', async () => {
    const { startWorkers } = await loadWorkersModule()
    const workers = startWorkers()

    expect(workers).toHaveLength(3)
    expect(hoisted.workerCtor).toHaveBeenCalledTimes(3)
    expect(hoisted.workerInstances.map((w) => w.queueName)).toEqual([
      'reminders',
      'emails',
      'cleanup',
    ])
    expect(hoisted.workerInstances.map((w) => w.options.concurrency)).toEqual([1, 2, 1])
  })

  it('reminder worker calls send-reminders endpoint with bearer auth', async () => {
    const { startWorkers } = await loadWorkersModule()
    startWorkers()

    const reminderWorker = hoisted.workerInstances.find((w) => w.queueName === 'reminders')
    expect(reminderWorker).toBeDefined()
    await reminderWorker!.processor({ name: 'daily-reminders' })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://nextjs:3000/api/cron/send-reminders',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret',
        },
      }
    )
  })

  it('email worker routes process-email-queue and send-upgrade-emails jobs', async () => {
    const { startWorkers } = await loadWorkersModule()
    startWorkers()

    const emailWorker = hoisted.workerInstances.find((w) => w.queueName === 'emails')
    expect(emailWorker).toBeDefined()

    await emailWorker!.processor({ name: 'process-email-queue' })
    await emailWorker!.processor({ name: 'send-upgrade-emails' })

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://nextjs:3000/api/cron/process-email-queue',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret',
        },
      }
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://nextjs:3000/api/cron/send-upgrade-emails',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret',
        },
      }
    )
  })

  it('email worker ignores unknown email jobs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { startWorkers } = await loadWorkersModule()
    startWorkers()

    const emailWorker = hoisted.workerInstances.find((w) => w.queueName === 'emails')
    expect(emailWorker).toBeDefined()
    await emailWorker!.processor({ name: 'unknown-job' })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[Worker] Unknown email job: unknown-job')
  })

  it('cleanup worker calls cleanupExpiredLimits for cleanup-expired jobs', async () => {
    const { startWorkers } = await loadWorkersModule()
    startWorkers()

    const cleanupWorker = hoisted.workerInstances.find((w) => w.queueName === 'cleanup')
    expect(cleanupWorker).toBeDefined()
    await cleanupWorker!.processor({ name: 'cleanup-expired' })

    expect(hoisted.cleanupExpiredLimits).toHaveBeenCalledTimes(1)
  })

  it('startWorkers is idempotent', async () => {
    const { startWorkers } = await loadWorkersModule()
    const first = startWorkers()
    const second = startWorkers()

    expect(first).toHaveLength(3)
    expect(second).toEqual([])
    expect(hoisted.workerCtor).toHaveBeenCalledTimes(3)
  })
})
