import type { ConnectionOptions } from 'bullmq'

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
    }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

export const redisConnection: ConnectionOptions = parseRedisUrl(
  process.env.REDIS_URL || 'redis://localhost:6379'
)
