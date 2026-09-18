import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../src/utils/ApiError.js';
import type {
  CategoryRecord,
  CategoryRepository,
} from '../src/modules/categories/category.repository.js';
import { getCategory, listCategories } from '../src/modules/categories/category.service.js';

const category: CategoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'temporary-category',
  displayName: 'Temporary category',
  description: null,
  isActive: true,
  displayOrder: 2,
};

function repository(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findActive: async () => [category],
    findActiveById: async () => category,
    ...overrides,
  };
}

describe('category service', () => {
  it('lists the active categories supplied by the repository', async () => {
    assert.deepEqual(await listCategories(repository()), [category]);
  });

  it('retrieves an active category', async () => {
    assert.deepEqual(await getCategory(category.id, repository()), category);
  });

  it('returns a safe not-found error for a missing or inactive category', async () => {
    await assert.rejects(
      () => getCategory(category.id, repository({ findActiveById: async () => null })),
      (error: unknown) =>
        error instanceof ApiError &&
        error.statusCode === 404 &&
        error.code === 'CATEGORY_NOT_FOUND',
    );
  });
});
