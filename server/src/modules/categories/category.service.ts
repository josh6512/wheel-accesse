import { ApiError } from '../../utils/ApiError.js';
import {
  categoryRepository,
  type CategoryRepository,
  type CategoryRecord,
} from './category.repository.js';

export function listCategories(
  repository: CategoryRepository = categoryRepository,
): Promise<CategoryRecord[]> {
  return repository.findActive();
}

export async function getCategory(
  id: string,
  repository: CategoryRepository = categoryRepository,
): Promise<CategoryRecord> {
  const category = await repository.findActiveById(id);
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'The requested category was not found.');
  }
  return category;
}
