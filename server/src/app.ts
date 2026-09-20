import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiV1Router } from './routes/apiV1.js';

export function createApp() {
  if (!env.AUTH_ACCESS_SECRET)
    throw new Error(
      'Configure AUTH_ACCESS_SECRET in the ignored server/.env before starting the API.',
    );
  if (env.NODE_ENV === 'production' && new URL(env.CLIENT_ORIGIN).protocol !== 'https:')
    throw new Error('Production CLIENT_ORIGIN must use HTTPS.');
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === env.CLIENT_ORIGIN),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: (_request, response) => {
        const requestId = randomUUID();
        response.setHeader('X-Request-Id', requestId);
        return requestId;
      },
      serializers: {
        req: (request) => ({
          id: request.id,
          method: request.method,
          url: String(request.url).split('?')[0],
        }),
        res: (response) => ({ statusCode: response.statusCode }),
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use('/api/v1', apiV1Router);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
