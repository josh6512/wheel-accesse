import type { PlaceSearchRequest } from '../services/placeSearchService';

export interface SearchUrlState {
  city: string;
  country: string;
  category: string;
  q: string;
  featureIds: string[];
  page: number;
  pageSize: number;
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export function parseSearchUrl(search: string): SearchUrlState {
  const query = new URLSearchParams(search);
  const featureIds = (query.get('features') ?? '')
    .split(',')
    .map((entry) => entry.split(':'))
    .filter((parts) => parts.length === 2 && parts[0] && parts[1] === 'true')
    .map(([id]) => id as string);

  return {
    city: query.get('city')?.trim() ?? '',
    country: query.get('country')?.trim().toUpperCase() ?? '',
    category: query.get('category')?.trim() ?? '',
    q: query.get('q')?.trim() ?? '',
    featureIds: [...new Set(featureIds)],
    page: positiveInteger(query.get('page'), 1, 100_000),
    pageSize: positiveInteger(query.get('pageSize'), 20, 100),
  };
}

export function toSearchUrl(state: SearchUrlState): string {
  const query = new URLSearchParams();
  if (state.city) query.set('city', state.city);
  if (state.country) query.set('country', state.country);
  if (state.category) query.set('category', state.category);
  if (state.q) query.set('q', state.q);
  if (state.featureIds.length) {
    query.set('features', state.featureIds.map((id) => `${id}:true`).join(','));
  }
  if (state.page !== 1) query.set('page', String(state.page));
  if (state.pageSize !== 20) query.set('pageSize', String(state.pageSize));
  const value = query.toString();
  return value ? `/search?${value}` : '/search';
}

export function toPlaceSearchRequest(state: SearchUrlState): PlaceSearchRequest {
  const request: PlaceSearchRequest = {
    page: state.page,
    pageSize: state.pageSize,
  };
  if (state.city) request.city = state.city;
  if (state.country) request.country = state.country;
  if (state.category) request.category = state.category;
  if (state.q) request.q = state.q;
  if (state.featureIds.length) request.featureIds = state.featureIds;
  return request;
}
