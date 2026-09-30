/**
 * Atomic Redis-backed rate limiter for hourly limits.
 * Uses a sliding or fixed window depending on implementation.
 * We will use a simple fixed hour window for the assignment requirements.
 */
export declare const checkRateLimit: (senderId: string, hourlyLimit: number) => Promise<{
    allowed: boolean;
    currentCount: number;
}>;
/**
 * Determine how long to delay the job to shift it to the next hour if rate limit exceeded.
 */
export declare const getDelayForNextHour: () => number;
//# sourceMappingURL=rateLimiter.d.ts.map