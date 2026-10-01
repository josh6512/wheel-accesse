import { apiRequest } from './apiClient';

export type ReportTargetType = 'PLACE' | 'REVIEW' | 'PLACE_MEDIA' | 'REVIEW_MEDIA';
export type ReportReason =
  | 'INCORRECT_INFORMATION'
  | 'SPAM'
  | 'ABUSIVE_OR_HARASSING'
  | 'INAPPROPRIATE_MEDIA'
  | 'DUPLICATE'
  | 'OTHER';

export const reportReasons: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: 'INCORRECT_INFORMATION', label: 'Incorrect information' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'ABUSIVE_OR_HARASSING', label: 'Abusive or harassing' },
  { value: 'INAPPROPRIATE_MEDIA', label: 'Inappropriate media' },
  { value: 'DUPLICATE', label: 'Duplicate' },
  { value: 'OTHER', label: 'Other' },
];

export interface NewContentReport {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export function submitContentReport(input: NewContentReport) {
  return apiRequest<{ data: { id: string; status: 'OPEN' } }>(
    '/reports',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    true,
  );
}
