import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { writeLimits } from '../community/writeLimits.js';
import { createContentReportHandler } from './contentReport.controller.js';
import { createContentReportBodySchema } from './contentReport.validation.js';

export const contentReportRouter = Router();

// Five reports per account and fifteen per IP per 15 minutes; reads are unaffected.
contentReportRouter.post(
  '/',
  requireAuth,
  ...writeLimits(5),
  validateRequest({ body: createContentReportBodySchema }),
  createContentReportHandler,
);
