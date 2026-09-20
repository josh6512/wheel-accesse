export interface PublicReview {
  id: string;
  body: string;
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
  media: Array<{
    id: string;
    storageReference: string;
    altText: string | null;
    mimeType: string;
    displayOrder: number;
  }>;
}

export interface PaginatedReviews {
  data: PublicReview[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
