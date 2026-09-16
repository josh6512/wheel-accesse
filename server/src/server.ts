import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './db/prisma.js';

const app = createApp();
let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceShutdown = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceShutdown.unref();

  server.close(async (error) => {
    await prisma.$disconnect();
    clearTimeout(forceShutdown);
    if (error) {
      logger.error({ err: error }, 'HTTP server failed to close cleanly');
      process.exit(1);
    }
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
}

const server: Server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'API server listening');
});

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('SIGTERM');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('SIGTERM');
});
