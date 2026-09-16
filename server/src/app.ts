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
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: (request, response) => {
        const existingId = request.headers['x-request-id'];
        const requestId = typeof existingId === 'string' ? existingId : randomUUID();
        response.setHeader('X-Request-Id', requestId);
        return requestId;
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
