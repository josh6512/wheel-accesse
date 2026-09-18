import { z } from 'zod';

export const categoryIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;
