import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  AccessibilityFeatureRecord,
  AccessibilityFeatureRepository,
} from '../src/modules/accessibilityFeatures/accessibilityFeature.repository.js';
import {
  getAccessibilityFeature,
  listAccessibilityFeatures,
} from '../src/modules/accessibilityFeatures/accessibilityFeature.service.js';
import type {
  ActiveCategoryWithFeatures,
  CategoryFeatureRepository,
} from '../src/modules/categoryFeatures/categoryFeature.repository.js';
import { listCategoryFeatures } from '../src/modules/categoryFeatures/categoryFeature.service.js';
import { ApiError } from '../src/utils/ApiError.js';

const selectFeature: AccessibilityFeatureRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'temporary-select',
  displayName: 'Temporary select feature',
  description: null,
  valueType: 'select',
  unit: null,
  isActive: true,
  options: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      code: 'first',
      displayName: 'First',
      displayOrder: 1,
      isActive: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      code: 'second',
      displayName: 'Second',
      displayOrder: 2,
      isActive: true,
    },
  ],
};

function featureRepository(
  overrides: Partial<AccessibilityFeatureRepository> = {},
): AccessibilityFeatureRepository {
  return {
    findActive: async () => [selectFeature],
    findActiveById: async () => selectFeature,
    ...overrides,
  };
}

describe('accessibility feature service', () => {
  it('lists active feature metadata with ordered active options', async () => {
    const features = await listAccessibilityFeatures(featureRepository());
    assert.deepEqual(
      features[0]?.options.map((option) => option.code),
      ['first', 'second'],
    );
  });

  it('retrieves a feature and its options', async () => {
    assert.deepEqual(
      await getAccessibilityFeature(selectFeature.id, featureRepository()),
      selectFeature,
    );
  });

  it('returns a safe not-found error for a missing feature', async () => {
    await assert.rejects(
      () =>
        getAccessibilityFeature(
          selectFeature.id,
          featureRepository({ findActiveById: async () => null }),
        ),
      (error: unknown) =>
        error instanceof ApiError &&
        error.statusCode === 404 &&
        error.code === 'ACCESSIBILITY_FEATURE_NOT_FOUND',
    );
  });
});

describe('category feature service', () => {
  it('preserves category-feature and option display order', async () => {
    const category: ActiveCategoryWithFeatures = {
      features: [
        { displayOrder: 1, isPrimary: true, feature: selectFeature },
        {
          displayOrder: 2,
          isPrimary: false,
          feature: { ...selectFeature, id: '55555555-5555-4555-8555-555555555555' },
        },
      ],
    };
    const repository: CategoryFeatureRepository = {
      findForActiveCategory: async () => category,
    };

    const features = await listCategoryFeatures('11111111-1111-4111-8111-111111111111', repository);
    assert.deepEqual(
      features.map((feature) => feature.displayOrder),
      [1, 2],
    );
    assert.deepEqual(
      features[0]?.options.map((option) => option.displayOrder),
      [1, 2],
    );
  });

  it('returns category not found when the category is missing or inactive', async () => {
    const repository: CategoryFeatureRepository = {
      findForActiveCategory: async () => null,
    };

    await assert.rejects(
      () => listCategoryFeatures('11111111-1111-4111-8111-111111111111', repository),
      (error: unknown) =>
        error instanceof ApiError &&
        error.statusCode === 404 &&
        error.code === 'CATEGORY_NOT_FOUND',
    );
  });
});
