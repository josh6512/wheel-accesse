import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError.js';
import { placeRepository, type PlaceRecord, type PlaceRepository } from './place.repository.js';
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

function toPlaceResponse(place: PlaceRecord): PlaceResponse {
  return {
    ...place,
    latitude: place.latitude === null ? null : place.latitude.toNumber(),
    longitude: place.longitude === null ? null : place.longitude.toNumber(),
  };
}

export async function getPlace(
  id: string,
  repository: PlaceRepository = placeRepository,
): Promise<PlaceResponse> {
  const place = await repository.findById(id);
  if (!place) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', 'The requested place was not found.');
  }
  return toPlaceResponse(place);
}

export async function createPlace(
  input: CreatePlaceInput,
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
    return toPlaceResponse(await repository.create(input));
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
