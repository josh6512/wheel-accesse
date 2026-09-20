import type { PaginatedAccessibilityReports, PaginatedReviews, PlaceDetails } from '../types/api';
import { apiRequest } from './apiClient';

export function getPlaceDetails(placeId: string, signal?: AbortSignal): Promise<PlaceDetails> {
  return apiRequest<{ data: PlaceDetails }>(
    `/places/${encodeURIComponent(placeId)}`,
    signal ? { signal } : undefined,
  ).then(({ data }) => data);
}

export function getPlaceReviews(
  placeId: string,
  page: number,
  signal?: AbortSignal,
): Promise<PaginatedReviews> {
  const query = new URLSearchParams({ page: String(page), pageSize: '5' });
  return apiRequest(
    `/places/${encodeURIComponent(placeId)}/reviews?${query}`,
    signal ? { signal } : undefined,
  );
}

export function getPlaceAccessibilityReports(
  placeId: string,
  page: number,
  signal?: AbortSignal,
): Promise<PaginatedAccessibilityReports> {
  const query = new URLSearchParams({ page: String(page), pageSize: '5' });
  return apiRequest(
    `/places/${encodeURIComponent(placeId)}/accessibility-reports?${query}`,
    signal ? { signal } : undefined,
  );
}
