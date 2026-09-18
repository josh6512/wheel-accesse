import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();
const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, 'Country must be a two-letter code.')
  .transform((value) => value.toUpperCase());

export const placeIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const createPlaceBodySchema = z
  .strictObject({
    name: z.string().trim().min(1).max(200),
    categoryId: z.uuid(),
    address: optionalText(500),
    city: optionalText(120),
    region: optionalText(120),
    countryCode: countryCode.optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
  })
  .superRefine((place, context) => {
    if ((place.latitude === undefined) !== (place.longitude === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Latitude and longitude must be supplied together.',
      });
    }
  });

export const listPlaceQuerySchema = z.strictObject({
  category: z.uuid().optional(),
  city: optionalText(120),
  country: countryCode.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PlaceIdParams = z.infer<typeof placeIdParamsSchema>;
export type CreatePlaceInput = z.infer<typeof createPlaceBodySchema>;
export type ListPlaceQuery = z.infer<typeof listPlaceQuerySchema>;
