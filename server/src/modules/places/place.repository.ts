import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreatePlaceInput, ListPlaceQuery } from './place.validation.js';
import { writeTransaction } from '../community/writeTransaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { DuplicatePlaceError, likelyDuplicate } from './place.duplicates.js';

const placeSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  region: true,
  countryCode: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      code: true,
      displayName: true,
    },
  },
} satisfies Prisma.PlaceSelect;

export type PlaceRecord = Prisma.PlaceGetPayload<{ select: typeof placeSelect }>;

const placeDetailsSelect = {
  ...placeSelect,
  media: {
    where: { mediaAsset: { deletedAt: null } },
    orderBy: [{ displayOrder: 'asc' }, { mediaAssetId: 'asc' }],
    select: {
      displayOrder: true,
      mediaAsset: {
        select: {
          id: true,
          storageKey: true,
          mimeType: true,
          altText: true,
        },
      },
    },
  },
  _count: {
    select: {
      reviews: { where: { deletedAt: null } },
      reports: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.PlaceSelect;

export type PlaceDetailsRecord = Prisma.PlaceGetPayload<{ select: typeof placeDetailsSelect }>;

export interface PlaceAccessibilitySummaryRow {
  featureId: string;
  featureCode: string;
  featureDisplayName: string;
  featureDescription: string | null;
  positiveReports: bigint;
  negativeReports: bigint;
}

export interface PlaceListResult {
  items: PlaceRecord[];
  total: number;
}

export interface PlaceRepository {
  findDetailsById(id: string): Promise<PlaceDetailsRecord | null>;
  findBooleanAccessibilitySummary(id: string): Promise<PlaceAccessibilitySummaryRow[]>;
  findActiveCategoryById(categoryId: string): Promise<{ id: string } | null>;
  create(input: CreatePlaceInput, userId: string): Promise<PlaceRecord>;
  findMany(query: ListPlaceQuery): Promise<PlaceListResult>;
}

function activePlaceWhere(query: ListPlaceQuery): Prisma.PlaceWhereInput {
  return {
    deletedAt: null,
    category: { isActive: true },
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.country ? { countryCode: query.country } : {}),
  };
}

export const placeRepository: PlaceRepository = {
  findDetailsById: (id) =>
    prisma.place.findFirst({
      where: { id, deletedAt: null, category: { isActive: true } },
      select: placeDetailsSelect,
    }),
  findBooleanAccessibilitySummary: (id) =>
    prisma.$queryRaw<PlaceAccessibilitySummaryRow[]>(Prisma.sql`
      SELECT
        [feature].[id] AS [featureId],
        [feature].[code] AS [featureCode],
        [feature].[display_name] AS [featureDisplayName],
        [feature].[description] AS [featureDescription],
        SUM(CASE WHEN [answer].[boolean_value] = 1 THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END)
          AS [positiveReports],
        SUM(CASE WHEN [answer].[boolean_value] = 0 THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END)
          AS [negativeReports]
      FROM [dbo].[places] AS [place]
      INNER JOIN [dbo].[category_features] AS [mapping]
        ON [mapping].[category_id] = [place].[category_id] AND [mapping].[is_active] = 1
      INNER JOIN [dbo].[accessibility_features] AS [feature]
        ON [feature].[id] = [mapping].[feature_id]
        AND [feature].[is_active] = 1
        AND [feature].[value_type] = N'boolean'
      LEFT JOIN [dbo].[place_accessibility_reports] AS [report]
        ON [report].[place_id] = [place].[id] AND [report].[deleted_at] IS NULL
      LEFT JOIN [dbo].[place_accessibility_answers] AS [answer]
        ON [answer].[report_id] = [report].[id]
        AND [answer].[feature_id] = [feature].[id]
        AND [answer].[value_type] = N'boolean'
      WHERE [place].[id] = CAST(${id} AS UNIQUEIDENTIFIER)
        AND [place].[deleted_at] IS NULL
      GROUP BY
        [mapping].[display_order],
        [feature].[id],
        [feature].[code],
        [feature].[display_name],
        [feature].[description]
      ORDER BY
        [mapping].[display_order],
        [feature].[display_name],
        [feature].[id]
    `),
  findActiveCategoryById: (categoryId) =>
    prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    }),
  create: (input, userId) =>
    writeTransaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id: input.categoryId, isActive: true },
        select: { displayName: true },
      });
      if (!category)
        throw new ApiError(
          400,
          'INVALID_CATEGORY',
          'The selected category does not exist or is inactive.',
        );
      if (input.city && input.countryCode) {
        // Serializable range locks keep check + insert atomic, including empty ranges.
        // Read the country/category partition so whitespace normalization stays consistent.
        const candidates = await tx.place.findMany({
          where: { categoryId: input.categoryId, countryCode: input.countryCode, deletedAt: null },
          select: {
            id: true,
            name: true,
            city: true,
            countryCode: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        });
        const matches = candidates
          .map((candidate) => ({
            ...candidate,
            latitude: candidate.latitude?.toNumber() ?? null,
            longitude: candidate.longitude?.toNumber() ?? null,
          }))
          .filter((candidate) => likelyDuplicate(input, candidate, category.displayName))
          .slice(0, 5);
        if (matches.length) throw new DuplicatePlaceError(matches);
      }
      return tx.place.create({
        data: {
          name: input.name,
          categoryId: input.categoryId,
          address: input.address ?? null,
          city: input.city ?? null,
          region: input.region ?? null,
          countryCode: input.countryCode ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          createdById: userId,
        },
        select: placeSelect,
      });
    }),
  findMany: async (query) => {
    const where = activePlaceWhere(query);
    const [items, total] = await prisma.$transaction([
      prisma.place.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: placeSelect,
      }),
      prisma.place.count({ where }),
    ]);
    return { items, total };
  },
};
