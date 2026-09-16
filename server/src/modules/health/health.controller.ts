import type { RequestHandler } from 'express';
import { getHealthStatus } from './health.service.js';

export const getHealth: RequestHandler = async (_request, response, next) => {
  try {
    const health = await getHealthStatus();
    response.status(health.status === 'ok' ? 200 : 503).json(health);
  } catch (error) {
    next(error);
  }
};
