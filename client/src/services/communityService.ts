import { apiRequest, ApiError } from './apiClient';
import type { NewPlace, PublicReview, PublicAccessibilityReport, ReportAnswer } from '../types/api';

function write<T>(path: string, method: string, body?: unknown) {
  return apiRequest<T>(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    true,
  );
}
export const createPlace = (input: NewPlace) =>
  write<{ data: { id: string; name: string } }>('/places', 'POST', input);
export const publishReview = (placeId: string, body: string) =>
  write<{ data: PublicReview }>(`/places/${placeId}/reviews`, 'POST', { body });
export const editReview = (id: string, body: string) =>
  write<{ data: PublicReview }>(`/reviews/${id}`, 'PATCH', { body });
export const deleteReview = (id: string) => write<void>(`/reviews/${id}`, 'DELETE');
export const publishReport = (placeId: string, answers: ReportAnswer[]) =>
  write<{ data: PublicAccessibilityReport }>(`/places/${placeId}/accessibility-reports`, 'POST', {
    answers,
  });
export const deleteReport = (id: string) => write<void>(`/accessibility-reports/${id}`, 'DELETE');
export function writeError(reason: unknown): string {
  if (reason instanceof ApiError) {
    if (reason.status === 401) return 'Your session expired. Sign in again before contributing.';
    if (reason.status === 403) return 'Only the author can change this contribution.';
    if (reason.status === 429)
      return 'Too many contributions. Please wait a few minutes and try again.';
    return reason.message;
  }
  return 'We could not confirm the save. Check the place before retrying to avoid a duplicate.';
}

// A place is never rolled back because an optional follow-up fails. Each step has
// its own explicit outcome; no automatic retries of potentially completed writes.
export async function addPlaceWithContributions(
  input: NewPlace,
  answers: ReportAnswer[],
  review: string,
) {
  const { data: place } = await createPlace(input);
  const messages = ['Place created successfully.'];
  if (answers.length) {
    try {
      await publishReport(place.id, answers);
      messages.push('Accessibility information saved.');
    } catch (error) {
      messages.push(`Accessibility information was not confirmed saved. ${writeError(error)}`);
    }
  }
  if (review.trim()) {
    try {
      await publishReview(place.id, review.trim());
      messages.push('Review published.');
    } catch (error) {
      messages.push(`Review was not confirmed published. ${writeError(error)}`);
    }
  }
  return { place, messages };
}
