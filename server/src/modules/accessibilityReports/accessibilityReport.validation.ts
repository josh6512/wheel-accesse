import { z } from 'zod';

export const placeAccessibilityReportParamsSchema = z.strictObject({
  placeId: z.uuid(),
});

export const accessibilityReportIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const accessibilityReportListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const reportAnswerSchema = z.discriminatedUnion('type', [
  z.strictObject({
    featureId: z.uuid(),
    type: z.literal('boolean'),
    value: z.boolean(),
  }),
  z.strictObject({
    featureId: z.uuid(),
    type: z.literal('numeric'),
    value: z
      .number()
      .finite()
      .min(-99999999999999)
      .max(99999999999999)
      .refine(
        (value) => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00001,
        'Use at most four decimal places.',
      ),
  }),
  z.strictObject({
    featureId: z.uuid(),
    type: z.literal('text'),
    value: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    featureId: z.uuid(),
    type: z.literal('select'),
    optionId: z.uuid(),
  }),
]);

export const submitAccessibilityReportBodySchema = z
  .strictObject({
    observedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    answers: z.array(reportAnswerSchema).min(1).max(200),
  })
  .superRefine((report, context) => {
    const featureIds = new Set<string>();
    report.answers.forEach((answer, index) => {
      if (featureIds.has(answer.featureId)) {
        context.addIssue({
          code: 'custom',
          path: ['answers', index, 'featureId'],
          message: 'Each feature may be answered only once per report.',
        });
      }
      featureIds.add(answer.featureId);
    });
  });

export type PlaceAccessibilityReportParams = z.infer<typeof placeAccessibilityReportParamsSchema>;
export type AccessibilityReportIdParams = z.infer<typeof accessibilityReportIdParamsSchema>;
export type AccessibilityReportListQuery = z.infer<typeof accessibilityReportListQuerySchema>;
export type SubmitAccessibilityReportInput = z.infer<typeof submitAccessibilityReportBodySchema>;
export type ReportAnswerInput = SubmitAccessibilityReportInput['answers'][number];
