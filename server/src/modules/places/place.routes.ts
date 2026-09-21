import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { getPlaceHandler, createPlaceHandler } from './place.controller.js';
import { placeIdParamsSchema, createPlaceBodySchema } from './place.validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { writeLimits } from '../community/writeLimits.js';

export const placeRouter = Router();

placeRouter.post(
  '/',
  requireAuth,
  ...writeLimits(5),
  validateRequest({ body: createPlaceBodySchema }),
  createPlaceHandler,
);
placeRouter.get('/:id', validateRequest({ params: placeIdParamsSchema }), getPlaceHandler);
