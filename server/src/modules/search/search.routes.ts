import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { searchPlaceHandler } from './search.controller.js';
import { searchPlacesQuerySchema } from './search.validation.js';

export const searchRouter = Router();

searchRouter.get('/', validateRequest({ query: searchPlacesQuerySchema }), searchPlaceHandler);
