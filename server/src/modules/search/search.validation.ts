import { z } from 'zod';

export interface BooleanFeatureFilter {
  featureId: string;
  value: boolean;
}

const featureFiltersSchema = z
  .string()
  .trim()
  .min(1)
  .max(4000)
  .transform((raw, context): BooleanFeatureFilter[] => {
    const entries = raw.split(',');
    if (entries.length > 20) {
      context.addIssue({
        code: 'custom',
        message: 'At most 20 accessibility filters are allowed.',
      });
      return [];
    }

    const seen = new Set<string>();
    const filters: BooleanFeatureFilter[] = [];
    entries.forEach((entry) => {
      const parts = entry.split(':');
      const featureId = parts[0]?.trim();
      const rawValue = parts[1]?.trim();
      if (
        parts.length !== 2 ||
        !featureId ||
        !z.uuid().safeParse(featureId).success ||
        (rawValue !== 'true' && rawValue !== 'false')
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Each feature filter must use the format UUID:true or UUID:false.',
        });
        return;
      }

      const normalizedId = featureId.toLowerCase();
      if (seen.has(normalizedId)) {
        context.addIssue({
          code: 'custom',
          message: 'Each accessibility feature may be filtered only once.',
        });
        return;
      }
      seen.add(normalizedId);
      filters.push({ featureId: normalizedId, value: rawValue === 'true' });
    });
    return filters;
  });

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();

export const searchPlacesQuerySchema = z
  .strictObject({
    category: z.uuid().optional(),
    city: optionalText(120),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, 'Country must be a two-letter code.')
      .transform((value) => value.toUpperCase())
      .optional(),
    q: optionalText(200),
    features: featureFiltersSchema.optional().default([]),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((query, context) => {
    if (query.features.length > 0 && !query.category) {
      context.addIssue({
        code: 'custom',
        path: ['category'],
        message: 'Category is required when accessibility filters are supplied.',
      });
    }
  });

export type SearchPlacesQuery = z.infer<typeof searchPlacesQuerySchema>;
