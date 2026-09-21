import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { writeLimits } from '../community/writeLimits.js';
import { createReview, changeReview } from '../community/community.service.js';
import { getReviewHandler, listPlaceReviewHandler } from './review.controller.js';
import {
  placeReviewParamsSchema,
  reviewIdParamsSchema,
  reviewListQuerySchema,
  createReviewBodySchema,
  type PlaceReviewParams,
  type ReviewIdParams,
  type CreateReviewInput,
} from './review.validation.js';

export const placeReviewRouter = Router();
export const reviewRouter = Router();

placeReviewRouter.get(
  '/:placeId/reviews',
  validateRequest({ params: placeReviewParamsSchema, query: reviewListQuerySchema }),
  listPlaceReviewHandler,
);

reviewRouter.get('/:id', validateRequest({ params: reviewIdParamsSchema }), getReviewHandler);
placeReviewRouter.post(
  '/:placeId/reviews',
  requireAuth,
  ...writeLimits(20),
  validateRequest({ params: placeReviewParamsSchema, body: createReviewBodySchema }),
  async (request, response) => {
    const { placeId } = request.validated!.params as PlaceReviewParams;
    response.status(201).json({
      data: await createReview(
        placeId,
        request.validated!.body as CreateReviewInput,
        request.auth!.userId,
      ),
    });
  },
);
reviewRouter.patch(
  '/:id',
  requireAuth,
  ...writeLimits(30),
  validateRequest({ params: reviewIdParamsSchema, body: createReviewBodySchema }),
  async (request, response) => {
    const { id } = request.validated!.params as ReviewIdParams;
    response.json({
      data: await changeReview(
        id,
        request.auth!.userId,
        request.validated!.body as CreateReviewInput,
      ),
    });
  },
);
reviewRouter.delete(
  '/:id',
  requireAuth,
  ...writeLimits(30),
  validateRequest({ params: reviewIdParamsSchema }),
  async (request, response) => {
    const { id } = request.validated!.params as ReviewIdParams;
    await changeReview(id, request.auth!.userId, null);
    response.status(204).end();
  },
);
