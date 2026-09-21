import { Prisma } from '@prisma/client';
import { deriveAccessibilityStatus } from '../search/search.aggregation.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  placeRepository,
  type PlaceAccessibilitySummaryRow,
  type PlaceDetailsRecord,
  type PlaceRecord,
  type PlaceRepository,
} from './place.repository.js';
import type { CreatePlaceInput, ListPlaceQuery } from './place.validation.js';

export interface PlaceResponse {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    code: string;
    displayName: string;
  };
}

export interface PaginatedPlaces {
  data: PlaceResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface PlaceDetailsResponse extends PlaceResponse {
  media: Array<{
    id: string;
    storageReference: string;
    altText: string | null;
    mimeType: string;
    displayOrder: number;
  }>;
  reviewCount: number;
  accessibilityReportCount: number;
  accessibility: Array<{
    feature: {
      id: string;
      code: string;
      displayName: string;
      description: string | null;
    };
    status: 'SUPPORTED' | 'NOT_SUPPORTED' | 'CONFLICTING' | 'UNKNOWN';
    positiveReports: number;
    negativeReports: number;
  }>;
}

function toPlaceResponse(place: PlaceRecord): PlaceResponse {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    city: place.city,
    region: place.region,
    countryCode: place.countryCode,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
    category: place.category,
    latitude: place.latitude === null ? null : place.latitude.toNumber(),
    longitude: place.longitude === null ? null : place.longitude.toNumber(),
  };
}

function safeCount(value: bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    throw new Error('A place accessibility aggregate exceeded the safe integer range.');
  }
  return count;
}

function toAccessibilitySummary(row: PlaceAccessibilitySummaryRow) {
  const positiveReports = safeCount(row.positiveReports);
  const negativeReports = safeCount(row.negativeReports);
  return {
    feature: {
      id: row.featureId,
      code: row.featureCode,
      displayName: row.featureDisplayName,
      description: row.featureDescription,
    },
    status: deriveAccessibilityStatus(positiveReports, negativeReports),
    positiveReports,
    negativeReports,
  };
}

function toPlaceDetailsResponse(
  place: PlaceDetailsRecord,
  accessibility: PlaceAccessibilitySummaryRow[],
): PlaceDetailsResponse {
  return {
    ...toPlaceResponse(place),
    media: place.media.map(({ displayOrder, mediaAsset }) => ({
      id: mediaAsset.id,
      storageReference: mediaAsset.storageKey,
      altText: mediaAsset.altText,
      mimeType: mediaAsset.mimeType,
      displayOrder,
    })),
    reviewCount: place._count.reviews,
    accessibilityReportCount: place._count.reports,
    accessibility: accessibility.map(toAccessibilitySummary),
  };
}

export async function getPlace(
  id: string,
  repository: PlaceRepository = placeRepository,
): Promise<PlaceDetailsResponse> {
  const place = await repository.findDetailsById(id);
  if (!place) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', 'The requested place was not found.');
  }
  const accessibility = await repository.findBooleanAccessibilitySummary(id);
  return toPlaceDetailsResponse(place, accessibility);
}

export async function createPlace(
  input: CreatePlaceInput,
  authenticatedUserId: string,
  repository: PlaceRepository = placeRepository,
): Promise<PlaceResponse> {
  const category = await repository.findActiveCategoryById(input.categoryId);
  if (!category) {
    throw new ApiError(
      400,
      'INVALID_CATEGORY',
      'The selected category does not exist or is inactive.',
    );
  }

  try {
    return toPlaceResponse(await repository.create(input, authenticatedUserId));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new ApiError(
        400,
        'INVALID_CATEGORY',
        'The selected category does not exist or is inactive.',
      );
    }
    throw error;
  }
}

export async function listPlaces(
  query: ListPlaceQuery,
  repository: PlaceRepository = placeRepository,
): Promise<PaginatedPlaces> {
  const { items, total } = await repository.findMany(query);
  const totalPages = Math.ceil(total / query.pageSize);

  return {
    data: items.map(toPlaceResponse),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: total,
      totalPages,
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page < totalPages,
    },
  };
}
