import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { SearchPlacesQuery } from './search.validation.js';

export interface SearchPlaceRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;
  categoryCode: string;
  categoryDisplayName: string;
  reviewCount: bigint;
}

export interface SearchSummaryRow {
  placeId: string;
  featureId: string;
  featureCode: string;
  featureDisplayName: string;
  positiveReports: bigint;
  negativeReports: bigint;
}

export interface ActiveCategoryFeatureContext {
  features: Array<{
    feature: {
      id: string;
      valueType: string;
    };
  }>;
}

export interface SearchRepositoryResult {
  items: SearchPlaceRow[];
  summaries: SearchSummaryRow[];
  total: bigint;
}

export interface SearchRepository {
  findActiveCategoryFeatures(
    categoryId: string,
    featureIds: string[],
  ): Promise<ActiveCategoryFeatureContext | null>;
  search(query: SearchPlacesQuery): Promise<SearchRepositoryResult>;
}

function escapeLikePattern(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('[', '\\[');
}

function booleanConsensusPredicate(featureId: string, requestedValue: boolean): Prisma.Sql {
  const consensus = requestedValue
    ? Prisma.sql`
        SUM(CASE WHEN [a].[boolean_value] = 1 THEN 1 ELSE 0 END)
          > SUM(CASE WHEN [a].[boolean_value] = 0 THEN 1 ELSE 0 END)
      `
    : Prisma.sql`
        SUM(CASE WHEN [a].[boolean_value] = 0 THEN 1 ELSE 0 END)
          > SUM(CASE WHEN [a].[boolean_value] = 1 THEN 1 ELSE 0 END)
      `;

  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM [dbo].[category_features] AS [filter_mapping]
      INNER JOIN [dbo].[accessibility_features] AS [filter_feature]
        ON [filter_feature].[id] = [filter_mapping].[feature_id]
      WHERE [filter_mapping].[category_id] = [p].[category_id]
        AND [filter_mapping].[feature_id] = CAST(${featureId} AS UNIQUEIDENTIFIER)
        AND [filter_mapping].[is_active] = 1
        AND [filter_feature].[is_active] = 1
        AND [filter_feature].[value_type] = N'boolean'
    )
    AND EXISTS (
      SELECT 1
      FROM [dbo].[place_accessibility_reports] AS [r]
      INNER JOIN [dbo].[place_accessibility_answers] AS [a]
        ON [a].[report_id] = [r].[id]
      WHERE [r].[place_id] = [p].[id]
        AND [r].[deleted_at] IS NULL
        AND [a].[feature_id] = CAST(${featureId} AS UNIQUEIDENTIFIER)
        AND [a].[value_type] = N'boolean'
      GROUP BY [a].[feature_id]
      HAVING ${consensus}
    )
  `;
}

function searchWhere(query: SearchPlacesQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`[p].[deleted_at] IS NULL`,
    Prisma.sql`[c].[is_active] = 1`,
  ];
  if (query.category) {
    conditions.push(Prisma.sql`[p].[category_id] = CAST(${query.category} AS UNIQUEIDENTIFIER)`);
  }
  if (query.city) {
    conditions.push(Prisma.sql`LOWER([p].[city]) = LOWER(${query.city})`);
  }
  if (query.country) {
    conditions.push(Prisma.sql`UPPER([p].[country_code]) = ${query.country}`);
  }
  if (query.q) {
    const pattern = `%${escapeLikePattern(query.q)}%`;
    conditions.push(Prisma.sql`LOWER([p].[name]) LIKE LOWER(${pattern}) ESCAPE N'\\'`);
  }
  query.features.forEach((filter) => {
    conditions.push(booleanConsensusPredicate(filter.featureId, filter.value));
  });
  return Prisma.join(conditions, ' AND ');
}

export const searchRepository: SearchRepository = {
  findActiveCategoryFeatures: (categoryId, featureIds) =>
    prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: {
        features: {
          where: {
            featureId: { in: featureIds },
            isActive: true,
            feature: { isActive: true },
          },
          select: {
            feature: { select: { id: true, valueType: true } },
          },
        },
      },
    }),
  search: async (query) => {
    const where = searchWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const countQuery = prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT_BIG(*) AS [total]
      FROM [dbo].[places] AS [p]
      INNER JOIN [dbo].[categories] AS [c] ON [c].[id] = [p].[category_id]
      WHERE ${where}
    `);
    const placesQuery = prisma.$queryRaw<SearchPlaceRow[]>(Prisma.sql`
      SELECT
        [p].[id],
        [p].[name],
        [p].[address],
        [p].[city],
        [p].[region],
        [p].[country_code] AS [countryCode],
        [p].[latitude],
        [p].[longitude],
        [p].[created_at] AS [createdAt],
        [p].[updated_at] AS [updatedAt],
        [c].[id] AS [categoryId],
        [c].[code] AS [categoryCode],
        [c].[display_name] AS [categoryDisplayName],
        (
          SELECT COUNT_BIG(*)
          FROM [dbo].[reviews] AS [review]
          WHERE [review].[place_id] = [p].[id] AND [review].[deleted_at] IS NULL
        ) AS [reviewCount]
      FROM [dbo].[places] AS [p]
      INNER JOIN [dbo].[categories] AS [c] ON [c].[id] = [p].[category_id]
      WHERE ${where}
      ORDER BY [p].[created_at] DESC, [p].[id] DESC
      OFFSET ${skip} ROWS FETCH NEXT ${query.pageSize} ROWS ONLY
    `);
    const [countRows, items] = await prisma.$transaction([countQuery, placesQuery]);

    if (items.length === 0) {
      return { items, summaries: [], total: countRows[0]?.total ?? 0n };
    }

    const placeIds = items.map((item) => item.id);
    const summaries = await prisma.$queryRaw<SearchSummaryRow[]>(Prisma.sql`
      SELECT
        [p].[id] AS [placeId],
        [feature].[id] AS [featureId],
        [feature].[code] AS [featureCode],
        [feature].[display_name] AS [featureDisplayName],
        SUM(CASE WHEN [answer].[boolean_value] = 1 THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END)
          AS [positiveReports],
        SUM(CASE WHEN [answer].[boolean_value] = 0 THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END)
          AS [negativeReports]
      FROM [dbo].[places] AS [p]
      INNER JOIN [dbo].[category_features] AS [mapping]
        ON [mapping].[category_id] = [p].[category_id] AND [mapping].[is_active] = 1
      INNER JOIN [dbo].[accessibility_features] AS [feature]
        ON [feature].[id] = [mapping].[feature_id]
        AND [feature].[is_active] = 1
        AND [feature].[value_type] = N'boolean'
      LEFT JOIN [dbo].[place_accessibility_reports] AS [report]
        ON [report].[place_id] = [p].[id] AND [report].[deleted_at] IS NULL
      LEFT JOIN [dbo].[place_accessibility_answers] AS [answer]
        ON [answer].[report_id] = [report].[id]
        AND [answer].[feature_id] = [feature].[id]
        AND [answer].[value_type] = N'boolean'
      WHERE [p].[id] IN (${Prisma.join(
        placeIds.map((placeId) => Prisma.sql`CAST(${placeId} AS UNIQUEIDENTIFIER)`),
      )})
      GROUP BY
        [p].[id],
        [mapping].[display_order],
        [feature].[id],
        [feature].[code],
        [feature].[display_name]
      ORDER BY
        [p].[id],
        [mapping].[display_order],
        [feature].[display_name],
        [feature].[id]
    `);

    return { items, summaries, total: countRows[0]?.total ?? 0n };
  },
};
