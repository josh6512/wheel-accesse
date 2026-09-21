import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import type {
  PlaceAccessibilitySummaryRow,
  PlaceDetailsRecord,
  PlaceRecord,
  PlaceRepository,
} from '../src/modules/places/place.repository.js';
import { createPlace, getPlace, listPlaces } from '../src/modules/places/place.service.js';
import {
  createPlaceBodySchema,
  listPlaceQuerySchema,
  type ListPlaceQuery,
} from '../src/modules/places/place.validation.js';
import { ApiError } from '../src/utils/ApiError.js';

const categoryId = '11111111-1111-4111-8111-111111111111';
const placeId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-01-01T00:00:00.000Z');
const place: PlaceRecord = {
  id: placeId,
  name: 'Temporary place',
  address: null,
  city: 'Test City',
  region: null,
  countryCode: 'IL',
  latitude: new Prisma.Decimal('32.085300'),
  longitude: new Prisma.Decimal('34.781800'),
  createdAt: now,
  updatedAt: now,
  category: {
    id: categoryId,
    code: 'temporary-category',
    displayName: 'Temporary category',
  },
};

const placeDetails: PlaceDetailsRecord = {
  ...place,
  media: [
    {
      displayOrder: 10,
      mediaAsset: {
        id: '77777777-7777-4777-8777-777777777777',
        storageKey: 'https://media.example.test/place.jpg',
        mimeType: 'image/jpeg',
        altText: 'Step-free entrance at Temporary place',
      },
    },
  ],
  _count: { reviews: 3, reports: 4 },
};

function summary(
  featureId: string,
  positiveReports: number,
  negativeReports: number,
): PlaceAccessibilitySummaryRow {
  return {
    featureId,
    featureCode: `feature-${featureId.at(-1)}`,
    featureDisplayName: `Feature ${featureId.at(-1)}`,
    featureDescription: null,
    positiveReports: BigInt(positiveReports),
    negativeReports: BigInt(negativeReports),
  };
}

const accessibilitySummaries = [
  summary('10000000-0000-4000-8000-000000000001', 3, 1),
  summary('10000000-0000-4000-8000-000000000002', 1, 3),
  summary('10000000-0000-4000-8000-000000000003', 2, 2),
  summary('10000000-0000-4000-8000-000000000004', 0, 0),
];

function repository(overrides: Partial<PlaceRepository> = {}): PlaceRepository {
  return {
    findDetailsById: async () => placeDetails,
    findBooleanAccessibilitySummary: async () => accessibilitySummaries,
    findActiveCategoryById: async () => ({ id: categoryId }),
    create: async () => place,
    findMany: async () => ({ items: [place], total: 1 }),
    ...overrides,
  };
}

describe('place validation', () => {
  it('accepts a valid place, normalizes country, and rejects unexpected properties', () => {
    const valid = createPlaceBodySchema.parse({
      name: '  Temporary place  ',
      categoryId,
      countryCode: 'il',
      latitude: 32.0853,
      longitude: 34.7818,
    });
    assert.equal(valid.name, 'Temporary place');
    assert.equal(valid.countryCode, 'IL');
    assert.equal(
      createPlaceBodySchema.safeParse({ name: 'Place', categoryId, unexpected: true }).success,
      false,
    );
  });

  it('rejects partial or out-of-range coordinates', () => {
    assert.equal(
      createPlaceBodySchema.safeParse({ name: 'Place', categoryId, latitude: 10 }).success,
      false,
    );
    assert.equal(
      createPlaceBodySchema.safeParse({
        name: 'Place',
        categoryId,
        latitude: 91,
        longitude: 10,
      }).success,
      false,
    );
  });

  it('enforces pagination limits and defaults', () => {
    assert.deepEqual(listPlaceQuerySchema.parse({}), { page: 1, pageSize: 20 });
    assert.equal(listPlaceQuerySchema.safeParse({ pageSize: '101' }).success, false);
  });
});

describe('place service', () => {
  it('creates a place using trusted ownership', async () => {
    let capturedName: string | undefined;
    const result = await createPlace(
      { name: 'Temporary place', categoryId },
      'trusted-user',
      repository({
        create: async (input, userId) => {
          assert.equal(userId, 'trusted-user');
          capturedName = input.name;
          return place;
        },
      }),
    );
    assert.equal(capturedName, 'Temporary place');
    assert.equal(result.latitude, 32.0853);
  });

  it('rejects a missing or inactive category', async () => {
    await assert.rejects(
      () =>
        createPlace(
          { name: 'Temporary place', categoryId },
          'trusted-user',
          repository({ findActiveCategoryById: async () => null }),
        ),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 400 && error.code === 'INVALID_CATEGORY',
    );
  });

  it('retrieves a place and returns not found when absent', async () => {
    const result = await getPlace(placeId, repository());
    assert.equal(result.id, placeId);
    assert.equal(result.reviewCount, 3);
    assert.equal(result.accessibilityReportCount, 4);
    assert.deepEqual(
      result.accessibility.map(({ status }) => status),
      ['SUPPORTED', 'NOT_SUPPORTED', 'CONFLICTING', 'UNKNOWN'],
    );
    assert.deepEqual(result.media[0], {
      id: '77777777-7777-4777-8777-777777777777',
      storageReference: 'https://media.example.test/place.jpg',
      mimeType: 'image/jpeg',
      altText: 'Step-free entrance at Temporary place',
      displayOrder: 10,
    });
    await assert.rejects(
      () => getPlace(placeId, repository({ findDetailsById: async () => null })),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 404 && error.code === 'PLACE_NOT_FOUND',
    );
  });

  it('passes filters to data access and returns pagination metadata', async () => {
    const query: ListPlaceQuery = {
      category: categoryId,
      city: 'Test City',
      country: 'IL',
      page: 2,
      pageSize: 1,
    };
    let capturedQuery: ListPlaceQuery | undefined;
    const result = await listPlaces(
      query,
      repository({
        findMany: async (input) => {
          capturedQuery = input;
          return { items: [place], total: 3 };
        },
      }),
    );
    assert.deepEqual(capturedQuery, query);
    assert.deepEqual(result.pagination, {
      page: 2,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });
});
