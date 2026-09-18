import type { Category, CategoryFeature } from '../types/api';
import { apiRequest } from './apiClient';

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const response = await apiRequest<{ data: Category[] }>(
    '/categories',
    signal ? { signal } : undefined,
  );
  return response.data;
}

export async function getCategoryFeatures(
  categoryId: string,
  signal?: AbortSignal,
): Promise<CategoryFeature[]> {
  const response = await apiRequest<{ data: CategoryFeature[] }>(
    `/categories/${encodeURIComponent(categoryId)}/features`,
    signal ? { signal } : undefined,
  );
  return response.data;
}
