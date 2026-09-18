import { ApiError } from '../../utils/ApiError.js';
import {
  categoryFeatureRepository,
  type CategoryFeatureRepository,
} from './categoryFeature.repository.js';

export interface CategoryFeatureItem {
  displayOrder: number;
  isPrimary: boolean;
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  valueType: string;
  unit: string | null;
  isActive: boolean;
  options: Array<{
    id: string;
    code: string;
    displayName: string;
    displayOrder: number;
    isActive: boolean;
  }>;
}

export async function listCategoryFeatures(
  categoryId: string,
  repository: CategoryFeatureRepository = categoryFeatureRepository,
): Promise<CategoryFeatureItem[]> {
  const category = await repository.findForActiveCategory(categoryId);
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'The requested category was not found.');
  }

  return category.features.map(({ displayOrder, isPrimary, feature }) => ({
    displayOrder,
    isPrimary,
    ...feature,
  }));
}
