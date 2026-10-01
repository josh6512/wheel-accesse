import { z } from 'zod';

export const targetTypes = ['PLACE', 'REVIEW', 'PLACE_MEDIA', 'REVIEW_MEDIA'] as const;
export const reportReasons = [
  'INCORRECT_INFORMATION',
  'SPAM',
  'ABUSIVE_OR_HARASSING',
  'INAPPROPRIATE_MEDIA',
  'DUPLICATE',
  'OTHER',
] as const;

export const createContentReportBodySchema = z.strictObject({
  targetType: z.enum(targetTypes),
  targetId: z.uuid(),
  reason: z.enum(reportReasons),
  details: z.string().trim().min(1).max(1000).optional(),
});

export type CreateContentReportInput = z.infer<typeof createContentReportBodySchema>;
