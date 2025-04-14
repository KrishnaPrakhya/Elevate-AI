import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

export const CACHE_TTL = {
  SHORT: 60 * 5, // 5 minutes
  MEDIUM: 60 * 60, // 1 hour
  LONG: 60 * 60 * 24, // 1 day
  WEEK: 60 * 60 * 24 * 7, // 1 week
}

// Helper function to get cached data or fetch and cache it
export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM,
): Promise<T> {
  try {
    const cachedData = await redis.get<T>(key)

    if (cachedData) {
      console.log(`Cache hit for key: ${key}`)
      return cachedData
    }

    console.log(`Cache miss for key: ${key}, fetching data...`)
    const data = await fetchFn()

    await redis.set(key, data, { ex: ttl })

    return data
  } catch (error) {
    console.error(`Redis cache error for key ${key}:`, error)
    return fetchFn()
  }
}

// Helper to invalidate cache
export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key)
    console.log(`Cache invalidated for key: ${key}`)
  } catch (error) {
    console.error(`Failed to invalidate cache for key ${key}:`, error)
  }
}

// Helper to invalidate multiple cache keys with a pattern
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`)
    }
  } catch (error) {
    console.error(`Failed to invalidate cache pattern ${pattern}:`, error)
  }
}
