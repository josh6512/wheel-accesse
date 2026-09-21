import { rateLimit } from 'express-rate-limit';

export function writeLimits(limit: number, windowMs = 15 * 60 * 1000) {
  const options = {
    windowMs,
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    message: {
      error: {
        code: 'WRITE_RATE_LIMITED',
        message: 'Too many contributions. Please try again later.',
      },
    },
  };
  // Separate buckets prevent both IP rotation by one account and account rotation
  // from one IP. Mounted after requireAuth; reads never consume these budgets.
  return [
    rateLimit({ ...options, limit: limit * 3 }),
    rateLimit({ ...options, limit, keyGenerator: (request) => request.auth!.userId }),
  ];
}
