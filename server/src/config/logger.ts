import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.AUTH_ACCESS_SECRET',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.DATABASE_URL',
    ],
    censor: '[REDACTED]',
  },
});
