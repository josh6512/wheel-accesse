import type { AccessibilityStatus } from './search.aggregation.js';

export interface SearchAccessibilitySummary {
  feature: {
    id: string;
    code: string;
    displayName: string;
  };
  status: AccessibilityStatus;
  positiveReports: number;
  negativeReports: number;
}

export interface SearchPlaceResult {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    code: string;
    displayName: string;
  };
  accessibility: SearchAccessibilitySummary[];
  reviewCount: number;
}

export interface SearchPlacesResponse {
  data: SearchPlaceResult[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
