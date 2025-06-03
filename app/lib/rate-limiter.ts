/**
 * Simplified rate limiter for admin-only dashboard
 *
 * Since this dashboard is only accessed by one team member,
 * we'll use a more lenient rate limiting approach but still
 * maintain protection against potential brute force attacks.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store - for production with multiple servers, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>()

export function rateLimit(
  identifier: string,
  limit = 30, // Higher limit for admin user
  windowMs: number = 60 * 1000, // 1 minute window
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Clean up expired entries
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(identifier)
  }

  const currentEntry = rateLimitStore.get(identifier)

  if (!currentEntry) {
    // First request
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    }
  }

  if (currentEntry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: currentEntry.resetTime,
    }
  }

  // Increment count
  currentEntry.count++
  rateLimitStore.set(identifier, currentEntry)

  return {
    success: true,
    remaining: limit - currentEntry.count,
    resetTime: currentEntry.resetTime,
  }
}

// Clean up expired entries periodically
setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  },
  5 * 60 * 1000,
) // Clean up every 5 minutes
