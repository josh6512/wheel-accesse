import type { PlaceSearchResponse } from '../types/api';
import { apiRequest } from './apiClient';

export interface PlaceSearchRequest {
  city?: string;
  country?: string;
  category?: string;
  q?: string;
  featureIds?: string[];
  page: number;
  pageSize: number;
}

export function toPlaceSearchQuery(request: PlaceSearchRequest): string {
  const query = new URLSearchParams();
  if (request.city) query.set('city', request.city);
  if (request.country) query.set('country', request.country);
  if (request.category) query.set('category', request.category);
  if (request.q) query.set('q', request.q);
  if (request.featureIds?.length) {
    query.set('features', request.featureIds.map((id) => `${id}:true`).join(','));
  }
  query.set('page', String(request.page));
  query.set('pageSize', String(request.pageSize));
  return query.toString();
}

export function searchPlaces(
  request: PlaceSearchRequest,
  signal?: AbortSignal,
): Promise<PlaceSearchResponse> {
  return apiRequest(`/places?${toPlaceSearchQuery(request)}`, signal ? { signal } : undefined);
}
