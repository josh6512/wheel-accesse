import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { deriveAccessibilityStatus } from '../src/modules/search/search.aggregation.js';
import type {
  SearchRepository,
  SearchRepositoryResult,
} from '../src/modules/search/search.repository.js';
import { searchPlaces } from '../src/modules/search/search.service.js';
import { searchPlacesQuerySchema } from '../src/modules/search/search.validation.js';
import { ApiError } from '../src/utils/ApiError.js';

const categoryId = '11111111-1111-4111-8111-111111111111';
const firstFeatureId = '22222222-2222-4222-8222-222222222222';
const secondFeatureId = '33333333-3333-4333-8333-333333333333';
const placeId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-01-01T00:00:00.000Z');

const searchResult: SearchRepositoryResult = {
  items: [
    {
      id: placeId,
      name: 'Accessible library',
      address: '1 Test Street',
      city: 'Test City',
      region: null,
      countryCode: 'IL',
      latitude: new Prisma.Decimal('32.085300'),
      longitude: new Prisma.Decimal('34.781800'),
      createdAt: now,
      updatedAt: now,
      categoryId,
      categoryCode: 'library',
      categoryDisplayName: 'Library',
      reviewCount: 2n,
    },
  ],
  summaries: [
    {
      placeId,
      featureId: firstFeatureId,
      featureCode: 'step-free-entry',
      featureDisplayName: 'Step-free entry',
      positiveReports: 3n,
      negativeReports: 1n,
    },
    {
      placeId,
      featureId: secondFeatureId,
      featureCode: 'accessible-toilet',
      featureDisplayName: 'Accessible toilet',
      positiveReports: 0n,
      negativeReports: 0n,
    },
  ],
  total: 1n,
};

function repository(overrides: Partial<SearchRepository> = {}): SearchRepository {
  return {
    findActiveCategoryFeatures: async (_categoryId, featureIds) => ({
      features: featureIds.map((id) => ({ feature: { id, valueType: 'boolean' } })),
    }),
    search: async () => searchResult,
    ...overrides,
  };
}

describe('search consensus aggregation', () => {
  it('derives all four statuses from positive and negative report counts', () => {
    assert.equal(deriveAccessibilityStatus(3, 1), 'SUPPORTED');
    assert.equal(deriveAccessibilityStatus(1, 3), 'NOT_SUPPORTED');
    assert.equal(deriveAccessibilityStatus(2, 2), 'CONFLICTING');
    assert.equal(deriveAccessibilityStatus(0, 0), 'UNKNOWN');
  });
});

describe('search validation', () => {
  it('applies defaults and normalizes country and accessibility filters', () => {
    assert.deepEqual(searchPlacesQuerySchema.parse({}), {
      features: [],
      page: 1,
      pageSize: 20,
    });

    const query = searchPlacesQuerySchema.parse({
      category: categoryId,
      city: ' Test City ',
      country: 'il',
      q: ' library ',
      features: `${firstFeatureId}:true,${secondFeatureId}:false`,
      page: '2',
      pageSize: '10',
    });
    assert.equal(query.city, 'Test City');
    assert.equal(query.country, 'IL');
    assert.equal(query.q, 'library');
    assert.deepEqual(query.features, [
      { featureId: firstFeatureId, value: true },
      { featureId: secondFeatureId, value: false },
    ]);
    assert.equal(query.page, 2);
    assert.equal(query.pageSize, 10);
  });

  it('rejects unknown parameters and malformed, duplicate, or unscoped feature filters', () => {
    assert.equal(searchPlacesQuerySchema.safeParse({ unexpected: 'value' }).success, false);
    assert.equal(
      searchPlacesQuerySchema.safeParse({ category: categoryId, features: 'not-a-uuid:true' })
        .success,
      false,
    );
    assert.equal(
      searchPlacesQuerySchema.safeParse({ category: categoryId, features: `${firstFeatureId}:yes` })
        .success,
      false,
    );
    assert.equal(
      searchPlacesQuerySchema.safeParse({
        category: categoryId,
        features: `${firstFeatureId}:true,${firstFeatureId}:false`,
      }).success,
      false,
    );
    assert.equal(
      searchPlacesQuerySchema.safeParse({ features: `${firstFeatureId}:true` }).success,
      false,
    );
  });

  it('enforces paging, country, and maximum feature-filter limits', () => {
    assert.equal(searchPlacesQuerySchema.safeParse({ page: 0 }).success, false);
    assert.equal(searchPlacesQuerySchema.safeParse({ pageSize: 101 }).success, false);
    assert.equal(searchPlacesQuerySchema.safeParse({ country: 'ISR' }).success, false);
    const filters = Array.from(
      { length: 21 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}:true`,
    ).join(',');
    assert.equal(
      searchPlacesQuerySchema.safeParse({ category: categoryId, features: filters }).success,
      false,
    );
  });
});

describe('search service', () => {
  it('passes basic filters to data access and returns compact, private summaries', async () => {
    const query = searchPlacesQuerySchema.parse({
      category: categoryId,
      city: 'Test City',
      country: 'IL',
      q: 'library',
      page: 2,
      pageSize: 1,
    });
    let capturedQuery = searchPlacesQuerySchema.parse({});
    const result = await searchPlaces(
      query,
      repository({
        search: async (input) => {
          capturedQuery = input;
          return { ...searchResult, total: 3n };
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
    assert.equal(result.data[0]?.accessibility[0]?.status, 'SUPPORTED');
    assert.equal(result.data[0]?.accessibility[1]?.status, 'UNKNOWN');
    assert.equal(result.data[0]?.reviewCount, 2);
    assert.equal(JSON.stringify(result).includes('userId'), false);
    assert.equal(JSON.stringify(result).includes('reporter'), false);
  });

  it('validates every requested feature before running the search', async () => {
    const query = searchPlacesQuerySchema.parse({
      category: categoryId,
      features: `${firstFeatureId}:true,${secondFeatureId}:false`,
    });
    let searchCalled = false;
    await searchPlaces(
      query,
      repository({
        search: async () => {
          searchCalled = true;
          return searchResult;
        },
      }),
    );
    assert.equal(searchCalled, true);
  });

  it('rejects inactive, unrelated, missing, or non-boolean feature filters', async () => {
    const query = searchPlacesQuerySchema.parse({
      category: categoryId,
      features: `${firstFeatureId}:true`,
    });
    await assert.rejects(
      () => searchPlaces(query, repository({ findActiveCategoryFeatures: async () => null })),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_CATEGORY_FILTER',
    );
    await assert.rejects(
      () =>
        searchPlaces(
          query,
          repository({ findActiveCategoryFeatures: async () => ({ features: [] }) }),
        ),
      (error: unknown) =>
        error instanceof ApiError && error.code === 'INVALID_ACCESSIBILITY_FILTER',
    );
    await assert.rejects(
      () =>
        searchPlaces(
          query,
          repository({
            findActiveCategoryFeatures: async () => ({
              features: [{ feature: { id: firstFeatureId, valueType: 'text' } }],
            }),
          }),
        ),
      (error: unknown) =>
        error instanceof ApiError && error.code === 'INVALID_ACCESSIBILITY_FILTER',
    );
  });

  it('keeps aggregation isolated between places and safely handles an empty page', async () => {
    const otherPlaceId = '77777777-7777-4777-8777-777777777777';
    const query = searchPlacesQuerySchema.parse({});
    const result = await searchPlaces(
      query,
      repository({
        search: async () => ({
          ...searchResult,
          items: [
            ...searchResult.items,
            { ...searchResult.items[0]!, id: otherPlaceId, name: 'Second library' },
          ],
          summaries: [
            ...searchResult.summaries,
            {
              ...searchResult.summaries[0]!,
              placeId: otherPlaceId,
              positiveReports: 1n,
              negativeReports: 3n,
            },
          ],
          total: 2n,
        }),
      }),
    );
    assert.equal(result.data[0]?.accessibility[0]?.status, 'SUPPORTED');
    assert.equal(result.data[1]?.accessibility[0]?.status, 'NOT_SUPPORTED');

    const empty = await searchPlaces(
      searchPlacesQuerySchema.parse({ page: 99 }),
      repository({ search: async () => ({ items: [], summaries: [], total: 2n }) }),
    );
    assert.deepEqual(empty.data, []);
    assert.equal(empty.pagination.totalItems, 2);
    assert.equal(empty.pagination.totalPages, 1);
    assert.equal(empty.pagination.hasPreviousPage, true);
    assert.equal(empty.pagination.hasNextPage, false);
  });
});
