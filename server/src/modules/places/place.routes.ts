import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createPlaceHandler, getPlaceHandler } from './place.controller.js';
import { createPlaceBodySchema, placeIdParamsSchema } from './place.validation.js';

export const placeRouter = Router();

placeRouter.post('/', validateRequest({ body: createPlaceBodySchema }), createPlaceHandler);
placeRouter.get('/:id', validateRequest({ params: placeIdParamsSchema }), getPlaceHandler);
