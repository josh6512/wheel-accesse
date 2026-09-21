export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    matches?: DuplicatePlace[];
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

export interface PublicMedia {
  id: string;
  storageReference: string;
  altText: string | null;
  mimeType: string;
  displayOrder: number;
}

export interface AccessibilitySummary {
  feature: Pick<CategoryFeature, 'id' | 'code' | 'displayName' | 'description'>;
  status: AccessibilityStatus;
  positiveReports: number;
  negativeReports: number;
}

export interface PlaceDetails extends Omit<PlaceSearchResult, 'accessibility' | 'reviewCount'> {
  media: PublicMedia[];
  accessibility: AccessibilitySummary[];
  reviewCount: number;
  accessibilityReportCount: number;
}

export interface PublicReview {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  place: { id: string; name: string };
  author: { id: string; displayName: string | null } | null;
  media: PublicMedia[];
}

export interface PaginatedReviews {
  data: PublicReview[];
  pagination: Pagination;
}

export type AccessibilityAnswerValue =
  | { type: 'boolean'; value: boolean }
  | { type: 'numeric'; value: string; unit: string | null }
  | { type: 'text'; value: string }
  | {
      type: 'select';
      option: { id: string; code: string; displayName: string };
    };

export interface PublicAccessibilityReport {
  id: string;
  observedAt: string | null;
  createdAt: string;
  updatedAt: string;
  place: { id: string; name: string };
  author: null;
  answers: Array<{
    feature: Pick<
      CategoryFeature,
      'id' | 'code' | 'displayName' | 'description' | 'valueType' | 'unit'
    >;
    value: AccessibilityAnswerValue;
  }>;
}

export interface PaginatedAccessibilityReports {
  data: PublicAccessibilityReport[];
  pagination: Pagination;
}

export interface DuplicatePlace {
  id: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  address: string | null;
}
export interface NewPlace {
  name: string;
  categoryId: string;
  city: string;
  countryCode: string;
  address?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}
export type ReportAnswer =
  | { featureId: string; type: 'boolean'; value: boolean }
  | { featureId: string; type: 'numeric'; value: number }
  | { featureId: string; type: 'text'; value: string }
  | { featureId: string; type: 'select'; optionId: string };
