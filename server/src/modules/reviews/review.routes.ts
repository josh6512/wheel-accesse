import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { getReviewHandler, listPlaceReviewHandler } from './review.controller.js';
import {
  placeReviewParamsSchema,
  reviewIdParamsSchema,
  reviewListQuerySchema,
} from './review.validation.js';

export const placeReviewRouter = Router();
export const reviewRouter = Router();

placeReviewRouter.get(
  '/:placeId/reviews',
  validateRequest({ params: placeReviewParamsSchema, query: reviewListQuerySchema }),
  listPlaceReviewHandler,
);

reviewRouter.get('/:id', validateRequest({ params: reviewIdParamsSchema }), getReviewHandler);
