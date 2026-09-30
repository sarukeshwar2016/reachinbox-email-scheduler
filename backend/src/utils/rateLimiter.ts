import { redisConnection } from './redis';

/**
 * Atomic Redis-backed rate limiter for hourly limits.
 * Uses a sliding or fixed window depending on implementation.
 * We will use a simple fixed hour window for the assignment requirements.
 */
export const checkRateLimit = async (
  senderId: string,
  hourlyLimit: number
): Promise<{ allowed: boolean; currentCount: number }> => {
  const currentHour = new Date().toISOString().slice(0, 13); // e.g. 2026-09-30T15
  const key = `rate_limit:${senderId}:${currentHour}`;

  // Atomically increment the counter
  const count = await redisConnection.incr(key);

  // Set expiration for the key (1 hour) only if it's the first increment
  if (count === 1) {
    await redisConnection.expire(key, 3600);
  }

  return {
    allowed: count <= hourlyLimit,
    currentCount: count,
  };
};

/**
 * Determine how long to delay the job to shift it to the next hour if rate limit exceeded.
 */
export const getDelayForNextHour = (): number => {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1);
  nextHour.setMinutes(0, 0, 0); // Start of next hour
  
  // Add a small buffer to ensure the hour window has shifted
  return nextHour.getTime() - now.getTime() + 1000;
};
