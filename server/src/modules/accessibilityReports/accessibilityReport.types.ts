export type AccessibilityAnswerValue =
  | { type: 'boolean'; value: boolean }
  | { type: 'numeric'; value: string; unit: string | null }
  | { type: 'text'; value: string }
  | {
      type: 'select';
      option: { id: string; code: string; displayName: string };
    };

export interface PublicAccessibilityAnswer {
  feature: {
    id: string;
    code: string;
    displayName: string;
    description: string | null;
    valueType: string;
    unit: string | null;
  };
  value: AccessibilityAnswerValue;
}

export interface PublicAccessibilityReport {
  id: string;
  observedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  place: {
    id: string;
    name: string;
  };
  author: {
    id: string;
    displayName: string | null;
  } | null;
  answers: PublicAccessibilityAnswer[];
}

export interface PaginatedAccessibilityReports {
  data: PublicAccessibilityReport[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface PreparedAccessibilityAnswer {
  featureId: string;
  valueType: string;
  booleanValue: boolean | null;
  numericValue: number | null;
  numericUnit: string | null;
  textValue: string | null;
  optionId: string | null;
}
