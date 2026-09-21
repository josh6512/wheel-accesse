import { ApiError } from '../../utils/ApiError.js';
import { reviewRepositoryFor } from '../reviews/review.repository.js';
import { getReview, submitReview } from '../reviews/review.service.js';
import type { CreateReviewInput } from '../reviews/review.validation.js';
import { accessibilityReportRepositoryFor } from '../accessibilityReports/accessibilityReport.repository.js';
import { submitAccessibilityReport } from '../accessibilityReports/accessibilityReport.service.js';
import type { SubmitAccessibilityReportInput } from '../accessibilityReports/accessibilityReport.validation.js';
import { writeTransaction } from './writeTransaction.js';

export function assertOwner(resource: { userId: string | null } | null, userId: string) {
  if (!resource)
    throw new ApiError(404, 'CONTENT_NOT_FOUND', 'The requested contribution was not found.');
  if (resource.userId !== userId)
    throw new ApiError(403, 'NOT_CONTENT_OWNER', 'Only the author can change this contribution.');
}
export const createReview = (placeId: string, input: CreateReviewInput, userId: string) =>
  writeTransaction((tx) => submitReview(placeId, input, userId, reviewRepositoryFor(tx)));
export const createReport = (
  placeId: string,
  input: SubmitAccessibilityReportInput,
  userId: string,
) =>
  writeTransaction((tx) =>
    submitAccessibilityReport(placeId, input, userId, accessibilityReportRepositoryFor(tx)),
  );

export const changeReview = (id: string, userId: string, input: CreateReviewInput | null) =>
  writeTransaction(async (tx) => {
    const where = { id, deletedAt: null, place: { deletedAt: null, category: { isActive: true } } };
    assertOwner(await tx.review.findFirst({ where, select: { userId: true } }), userId);
    await tx.review.updateMany({
      where: { ...where, userId },
      data: input ? { body: input.body } : { deletedAt: new Date() },
    });
    if (input) return getReview(id, reviewRepositoryFor(tx));
  });
export const deleteReport = (id: string, userId: string) =>
  writeTransaction(async (tx) => {
    const where = { id, deletedAt: null, place: { deletedAt: null, category: { isActive: true } } };
    assertOwner(
      await tx.placeAccessibilityReport.findFirst({ where, select: { userId: true } }),
      userId,
    );
    await tx.placeAccessibilityReport.updateMany({
      where: { ...where, userId },
      data: { deletedAt: new Date() },
    });
  });
