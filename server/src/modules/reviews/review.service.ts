import { ApiError } from '../../utils/ApiError.js';
import { reviewRepository, type ReviewRecord, type ReviewRepository } from './review.repository.js';
import type { PaginatedReviews, PublicReview } from './review.types.js';
import type { CreateReviewInput, ReviewListQuery } from './review.validation.js';

function toPublicReview(review: ReviewRecord): PublicReview {
  return {
    id: review.id,
    body: review.body,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    place: review.place,
    author:
      review.user && review.user.deletedAt === null
        ? { id: review.user.id, displayName: review.user.displayName }
        : null,
  };
}

export async function listPlaceReviews(
  placeId: string,
  query: ReviewListQuery,
  repository: ReviewRepository = reviewRepository,
): Promise<PaginatedReviews> {
  const result = await repository.findForVisiblePlace(placeId, query);
  if (!result) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', 'The requested place was not found.');
  }

  const totalPages = Math.ceil(result.total / query.pageSize);
  return {
    data: result.items.map(toPublicReview),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.total,
      totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
      hasNextPage: query.page < totalPages,
    },
  };
}

export async function getReview(
  id: string,
  repository: ReviewRepository = reviewRepository,
): Promise<PublicReview> {
  const review = await repository.findPublicById(id);
  if (!review) {
    throw new ApiError(404, 'REVIEW_NOT_FOUND', 'The requested review was not found.');
  }
  return toPublicReview(review);
}

// Intentionally not routed until authentication supplies a trusted user ID.
export async function submitReview(
  placeId: string,
  input: CreateReviewInput,
  authenticatedUserId: string,
  repository: ReviewRepository = reviewRepository,
): Promise<PublicReview> {
  const place = await repository.findVisiblePlaceById(placeId);
  if (!place) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', 'The requested place was not found.');
  }
  return toPublicReview(await repository.create(placeId, authenticatedUserId, input));
}
