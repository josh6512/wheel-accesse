import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReviewRecord, ReviewRepository } from '../src/modules/reviews/review.repository.js';
import {
  getReview,
  listPlaceReviews,
  submitReview,
} from '../src/modules/reviews/review.service.js';
import { createReviewBodySchema } from '../src/modules/reviews/review.validation.js';
import { ApiError } from '../src/utils/ApiError.js';

const placeId = '11111111-1111-4111-8111-111111111111';
const reviewId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-01-01T00:00:00.000Z');
const review: ReviewRecord = {
  id: reviewId,
  body: 'A plain-text community comment.',
  createdAt: now,
  updatedAt: now,
  place: { id: placeId, name: 'Temporary place' },
  user: { id: userId, displayName: 'Test author', deletedAt: null },
};

function repository(overrides: Partial<ReviewRepository> = {}): ReviewRepository {
  return {
    findForVisiblePlace: async () => ({ items: [review], total: 1 }),
    findPublicById: async () => review,
    findVisiblePlaceById: async () => ({ id: placeId }),
    create: async () => review,
    ...overrides,
  };
}

describe('review reads', () => {
  it('lists reviews for a place with pagination', async () => {
    const result = await listPlaceReviews(
      placeId,
      { page: 2, pageSize: 1 },
      repository({ findForVisiblePlace: async () => ({ items: [review], total: 3 }) }),
    );
    assert.equal(result.data[0]?.id, reviewId);
    assert.deepEqual(result.pagination, {
      page: 2,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('returns place not found when the public place is missing', async () => {
    await assert.rejects(
      () =>
        listPlaceReviews(
          placeId,
          { page: 1, pageSize: 20 },
          repository({ findForVisiblePlace: async () => null }),
        ),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 404 && error.code === 'PLACE_NOT_FOUND',
    );
  });

  it('returns review not found when the review is unavailable', async () => {
    await assert.rejects(
      () => getReview(reviewId, repository({ findPublicById: async () => null })),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 404 && error.code === 'REVIEW_NOT_FOUND',
    );
  });

  it('exposes only the public author projection', async () => {
    const result = await getReview(reviewId, repository());
    assert.deepEqual(result.author, { id: userId, displayName: 'Test author' });
    assert.equal(result.author !== null && 'email' in result.author, false);
    assert.equal(result.author !== null && 'mobilityTypes' in result.author, false);
  });

  it('hides authors whose user record is deleted', async () => {
    const deletedAuthorReview: ReviewRecord = {
      ...review,
      user: { ...review.user!, deletedAt: now },
    };
    assert.equal(
      (await getReview(reviewId, repository({ findPublicById: async () => deletedAuthorReview })))
        .author,
      null,
    );
  });
});

describe('future authenticated review submission', () => {
  it('trims content and rejects blank, oversized, or ownership properties', () => {
    assert.equal(
      createReviewBodySchema.parse({ body: '  Useful comment  ' }).body,
      'Useful comment',
    );
    assert.equal(createReviewBodySchema.safeParse({ body: '   ' }).success, false);
    assert.equal(createReviewBodySchema.safeParse({ body: 'x'.repeat(4001) }).success, false);
    assert.equal(createReviewBodySchema.safeParse({ body: 'Comment', userId }).success, false);
  });

  it('uses only the trusted authenticated user ID supplied to the service', async () => {
    let capturedUserId: string | undefined;
    await submitReview(
      placeId,
      { body: 'Useful comment' },
      userId,
      repository({
        create: async (_placeId, trustedUserId) => {
          capturedUserId = trustedUserId;
          return review;
        },
      }),
    );
    assert.equal(capturedUserId, userId);
  });
});
