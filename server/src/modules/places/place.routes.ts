import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createPlaceHandler, getPlaceHandler, listPlaceHandler } from './place.controller.js';
import {
  createPlaceBodySchema,
  listPlaceQuerySchema,
  placeIdParamsSchema,
} from './place.validation.js';

export const placeRouter = Router();

placeRouter.get('/', validateRequest({ query: listPlaceQuerySchema }), listPlaceHandler);
placeRouter.post('/', validateRequest({ body: createPlaceBodySchema }), createPlaceHandler);
placeRouter.get('/:id', validateRequest({ params: placeIdParamsSchema }), getPlaceHandler);
