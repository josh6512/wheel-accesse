import type { RequestHandler } from 'express';
import { getReview, listPlaceReviews } from './review.service.js';
import type { PlaceReviewParams, ReviewIdParams, ReviewListQuery } from './review.validation.js';

export const listPlaceReviewHandler: RequestHandler = async (request, response, next) => {
  try {
    const { placeId } = request.validated?.params as PlaceReviewParams;
    const query = request.validated?.query as ReviewListQuery;
    response.json(await listPlaceReviews(placeId, query));
  } catch (error) {
    next(error);
  }
};

export const getReviewHandler: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validated?.params as ReviewIdParams;
    response.json({ data: await getReview(id) });
  } catch (error) {
    next(error);
  }
};
