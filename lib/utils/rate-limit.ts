/**
 * In-Memory Sliding Window Rate Limiter
 *
 * Provides rate limiting protection for sensitive endpoints
 * (webhook abuse protection, brute force challenge protection, contact linking flood).
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Checks whether an action keyed by `key` is allowed within `limit` per `windowMs`.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const earliest = record.timestamps[0] || now;
    const resetTime = earliest + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }

  // Record this request timestamp
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetTime: now + windowMs,
  };
}

/**
 * Reset rate limit store (useful for automated testing)
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}
