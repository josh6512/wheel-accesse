import { z } from 'zod';

export const categoryFeatureParamsSchema = z.strictObject({
  categoryId: z.uuid(),
});

export type CategoryFeatureParams = z.infer<typeof categoryFeatureParamsSchema>;
