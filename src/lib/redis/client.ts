import Redis from 'ioredis'
import { emitStructuredError, emitStructuredInfo } from '@/lib/errors/structured-logger'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 50, 2000)
      },
      lazyConnect: true,
    })

    redis.on('error', (err) => {
      emitStructuredError({
        error_type: 'cache',
        error_message: `Redis connection error: ${err.message}`,
        endpoint: 'lib/redis/client',
      })
    })

    redis.on('connect', () => {
      emitStructuredInfo({
        event_type: 'cache',
        event_message: 'Redis connected',
        endpoint: 'lib/redis/client',
      })
    })
  }
  return redis
}
