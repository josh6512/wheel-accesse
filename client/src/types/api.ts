export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface Category {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface CategoryFeature {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  valueType: 'boolean' | 'numeric' | 'select' | 'text';
  unit: string | null;
  isActive: boolean;
  displayOrder: number;
  isPrimary: boolean;
  options: Array<{
    id: string;
    code: string;
    displayName: string;
    displayOrder: number;
    isActive: boolean;
  }>;
}

export type AccessibilityStatus = 'SUPPORTED' | 'NOT_SUPPORTED' | 'CONFLICTING' | 'UNKNOWN';

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  category: Pick<Category, 'id' | 'code' | 'displayName'>;
  accessibility: Array<{
    feature: Pick<CategoryFeature, 'id' | 'code' | 'displayName'>;
    status: AccessibilityStatus;
    positiveReports: number;
    negativeReports: number;
  }>;
  reviewCount: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PlaceSearchResponse {
  data: PlaceSearchResult[];
  pagination: Pagination;
}
