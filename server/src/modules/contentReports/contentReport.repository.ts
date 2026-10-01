import type { Prisma } from '@prisma/client';
import type { ContentReportRepository, ReportTarget } from './contentReport.types.js';

const visiblePlace = { deletedAt: null, category: { isActive: true } } as const;

export function contentReportRepositoryFor(tx: Prisma.TransactionClient): ContentReportRepository {
  return {
    async findVisibleTarget(input): Promise<ReportTarget | null> {
      switch (input.targetType) {
        case 'PLACE': {
          const place = await tx.place.findFirst({
            where: { id: input.targetId, ...visiblePlace },
            select: { createdById: true },
          });
          return place ? { ownerIds: [place.createdById] } : null;
        }
        case 'REVIEW': {
          const review = await tx.review.findFirst({
            where: { id: input.targetId, deletedAt: null, place: visiblePlace },
            select: { userId: true },
          });
          return review ? { ownerIds: [review.userId] } : null;
        }
        case 'PLACE_MEDIA': {
          const asset = await tx.mediaAsset.findFirst({
            where: {
              id: input.targetId,
              deletedAt: null,
              places: { some: { place: visiblePlace } },
            },
            select: {
              uploaderId: true,
              places: {
                where: { place: visiblePlace },
                select: { place: { select: { createdById: true } } },
              },
            },
          });
          return asset
            ? {
                ownerIds: [asset.uploaderId, ...asset.places.map((row) => row.place.createdById)],
              }
            : null;
        }
        case 'REVIEW_MEDIA': {
          const asset = await tx.mediaAsset.findFirst({
            where: {
              id: input.targetId,
              deletedAt: null,
              reviews: {
                some: { review: { deletedAt: null, place: visiblePlace } },
              },
            },
            select: {
              uploaderId: true,
              reviews: {
                where: { review: { deletedAt: null, place: visiblePlace } },
                select: { review: { select: { userId: true } } },
              },
            },
          });
          return asset
            ? { ownerIds: [asset.uploaderId, ...asset.reviews.map((row) => row.review.userId)] }
            : null;
        }
      }
    },
    create(input, reporterUserId) {
      return tx.contentReport.create({
        data: {
          reporterUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          details: input.details ?? null,
          status: 'OPEN',
        },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          reason: true,
          status: true,
          createdAt: true,
        },
      });
    },
  };
}
