import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { getPlaceHandler } from './place.controller.js';
import { placeIdParamsSchema } from './place.validation.js';

export const placeRouter = Router();

// Content writes remain unexposed until their ownership and abuse rules are designed.
placeRouter.get('/:id', validateRequest({ params: placeIdParamsSchema }), getPlaceHandler);
