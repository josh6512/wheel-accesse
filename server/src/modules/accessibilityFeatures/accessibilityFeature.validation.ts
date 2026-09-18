import { z } from 'zod';

export const accessibilityFeatureIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export type AccessibilityFeatureIdParams = z.infer<typeof accessibilityFeatureIdParamsSchema>;
