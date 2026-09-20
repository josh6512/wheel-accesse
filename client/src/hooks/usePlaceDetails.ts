import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/apiClient';
import {
  getPlaceAccessibilityReports,
  getPlaceDetails,
  getPlaceReviews,
} from '../services/placeDetailsService';
import type { PaginatedAccessibilityReports, PaginatedReviews, PlaceDetails } from '../types/api';

export interface ResourceError {
  message: string;
  status: number | null;
}

export interface DetailResource<T> {
  data: T | null;
  loading: boolean;
  error: ResourceError | null;
  retry: () => void;
}

function resourceError(reason: unknown, fallback: string): ResourceError {
  return {
    message: reason instanceof Error ? reason.message : fallback,
    status: reason instanceof ApiError ? reason.status : null,
  };
}

export function usePlaceDetails(placeId: string, enabled: boolean): DetailResource<PlaceDetails> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: PlaceDetails | null;
    error: ResourceError | null;
  }>({ key: '', data: null, error: null });
  const key = enabled ? `${placeId}:${attempt}` : 'disabled';
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getPlaceDetails(placeId, controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState({ key, data: null, error: resourceError(reason, 'Place could not be loaded.') });
        }
      });
    return () => controller.abort();
  }, [enabled, key, placeId]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    loading: enabled && !current,
    error: current ? state.error : null,
    retry,
  };
}

export function usePlaceReviews(
  placeId: string,
  page: number,
  enabled: boolean,
): DetailResource<PaginatedReviews> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: PaginatedReviews | null;
    error: ResourceError | null;
  }>({ key: '', data: null, error: null });
  const key = enabled ? `${placeId}:${page}:${attempt}` : 'disabled';
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getPlaceReviews(placeId, page, controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            data: null,
            error: resourceError(reason, 'Reviews could not be loaded.'),
          });
        }
      });
    return () => controller.abort();
  }, [enabled, key, page, placeId]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    loading: enabled && !current,
    error: current ? state.error : null,
    retry,
  };
}

export function usePlaceAccessibilityReports(
  placeId: string,
  page: number,
  enabled: boolean,
): DetailResource<PaginatedAccessibilityReports> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: PaginatedAccessibilityReports | null;
    error: ResourceError | null;
  }>({ key: '', data: null, error: null });
  const key = enabled ? `${placeId}:${page}:${attempt}` : 'disabled';
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getPlaceAccessibilityReports(placeId, page, controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            data: null,
            error: resourceError(reason, 'Accessibility reports could not be loaded.'),
          });
        }
      });
    return () => controller.abort();
  }, [enabled, key, page, placeId]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    loading: enabled && !current,
    error: current ? state.error : null,
    retry,
  };
}
