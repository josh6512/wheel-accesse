import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreateReviewInput, ReviewListQuery } from './review.validation.js';

const reviewSelect = {
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  place: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      displayName: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.ReviewSelect;

export type ReviewRecord = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

export interface ReviewListRecord {
  items: ReviewRecord[];
  total: number;
}

export interface ReviewRepository {
  findForVisiblePlace(placeId: string, query: ReviewListQuery): Promise<ReviewListRecord | null>;
  findPublicById(id: string): Promise<ReviewRecord | null>;
  findVisiblePlaceById(placeId: string): Promise<{ id: string } | null>;
  create(placeId: string, userId: string, input: CreateReviewInput): Promise<ReviewRecord>;
}

export const reviewRepository: ReviewRepository = {
  findForVisiblePlace: async (placeId, query) => {
    const place = await prisma.place.findFirst({
      where: { id: placeId, deletedAt: null, category: { isActive: true } },
      select: {
        reviews: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: reviewSelect,
        },
        _count: {
          select: { reviews: { where: { deletedAt: null } } },
        },
      },
    });

    return place ? { items: place.reviews, total: place._count.reviews } : null;
  },
  findPublicById: (id) =>
    prisma.review.findFirst({
      where: {
        id,
        deletedAt: null,
        place: { deletedAt: null, category: { isActive: true } },
      },
      select: reviewSelect,
    }),
  findVisiblePlaceById: (placeId) =>
    prisma.place.findFirst({
      where: { id: placeId, deletedAt: null, category: { isActive: true } },
      select: { id: true },
    }),
  create: (placeId, userId, input) =>
    prisma.review.create({
      data: { placeId, userId, body: input.body },
      select: reviewSelect,
    }),
};
