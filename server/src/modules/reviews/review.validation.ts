import { z } from 'zod';

export const placeReviewParamsSchema = z.strictObject({
  placeId: z.uuid(),
});

export const reviewIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const reviewListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Used by the future authenticated controller. No public write route exists yet.
export const createReviewBodySchema = z.strictObject({
  body: z.string().trim().min(1).max(4000),
});

export type PlaceReviewParams = z.infer<typeof placeReviewParamsSchema>;
export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
export type CreateReviewInput = z.infer<typeof createReviewBodySchema>;
