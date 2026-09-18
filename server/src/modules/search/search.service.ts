import { ApiError } from '../../utils/ApiError.js';
import { deriveAccessibilityStatus } from './search.aggregation.js';
import {
  searchRepository,
  type SearchRepository,
  type SearchSummaryRow,
} from './search.repository.js';
import type { SearchAccessibilitySummary, SearchPlacesResponse } from './search.types.js';
import type { SearchPlacesQuery } from './search.validation.js';

function safeCount(value: bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    throw new Error('A search aggregate exceeded the supported safe integer range.');
  }
  return count;
}

function toAccessibilitySummary(row: SearchSummaryRow): SearchAccessibilitySummary {
  const positiveReports = safeCount(row.positiveReports);
  const negativeReports = safeCount(row.negativeReports);
  return {
    feature: {
      id: row.featureId,
      code: row.featureCode,
      displayName: row.featureDisplayName,
    },
    status: deriveAccessibilityStatus(positiveReports, negativeReports),
    positiveReports,
    negativeReports,
  };
}

async function validateAccessibilityFilters(
  query: SearchPlacesQuery,
  repository: SearchRepository,
): Promise<void> {
  if (query.features.length === 0) return;

  const categoryId = query.category;
  if (!categoryId) {
    throw new ApiError(
      400,
      'CATEGORY_REQUIRED_FOR_ACCESSIBILITY_FILTERS',
      'Category is required when accessibility filters are supplied.',
    );
  }

  const context = await repository.findActiveCategoryFeatures(
    categoryId,
    query.features.map((filter) => filter.featureId),
  );
  if (!context) {
    throw new ApiError(
      400,
      'INVALID_CATEGORY_FILTER',
      'The selected category does not exist or is inactive.',
    );
  }

  const activeBooleanFeatureIds = new Set(
    context.features
      .filter(({ feature }) => feature.valueType === 'boolean')
      .map(({ feature }) => feature.id.toLowerCase()),
  );
  if (query.features.some((filter) => !activeBooleanFeatureIds.has(filter.featureId))) {
    throw new ApiError(
      400,
      'INVALID_ACCESSIBILITY_FILTER',
      'A feature is inactive, non-boolean, or not configured for the selected category.',
    );
  }
}

export async function searchPlaces(
  query: SearchPlacesQuery,
  repository: SearchRepository = searchRepository,
): Promise<SearchPlacesResponse> {
  await validateAccessibilityFilters(query, repository);
  const result = await repository.search(query);
  const summariesByPlace = new Map<string, SearchAccessibilitySummary[]>();
  result.summaries.forEach((summary) => {
    const key = summary.placeId.toLowerCase();
    const existing = summariesByPlace.get(key) ?? [];
    existing.push(toAccessibilitySummary(summary));
    summariesByPlace.set(key, existing);
  });

  const totalItems = safeCount(result.total);
  const totalPages = Math.ceil(totalItems / query.pageSize);
  return {
    data: result.items.map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address,
      city: place.city,
      region: place.region,
      countryCode: place.countryCode,
      latitude: place.latitude === null ? null : place.latitude.toNumber(),
      longitude: place.longitude === null ? null : place.longitude.toNumber(),
      createdAt: place.createdAt,
      updatedAt: place.updatedAt,
      category: {
        id: place.categoryId,
        code: place.categoryCode,
        displayName: place.categoryDisplayName,
      },
      accessibility: summariesByPlace.get(place.id.toLowerCase()) ?? [],
      reviewCount: safeCount(place.reviewCount),
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
      hasNextPage: query.page < totalPages,
    },
  };
}
