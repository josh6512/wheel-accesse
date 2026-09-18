import { useCallback, useEffect, useState } from 'react';
import { toPlaceSearchRequest, type SearchUrlState } from '../search/searchUrlState';
import { getCategories, getCategoryFeatures } from '../services/catalogService';
import { searchPlaces } from '../services/placeSearchService';
import type { Category, CategoryFeature, PlaceSearchResponse } from '../types/api';

interface Resource<T> {
  data: T;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

interface SettledResource<T> {
  key: string;
  data: T;
  error: string | null;
}

export function useCategories(): Resource<Category[]> {
  const [attempt, setAttempt] = useState(0);
  const key = `categories:${attempt}`;
  const [settled, setSettled] = useState<SettledResource<Category[]>>({
    key: '',
    data: [],
    error: null,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void getCategories(controller.signal)
      .then((data) => setSettled({ key, data, error: null }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({
            key,
            data: [],
            error: reason instanceof Error ? reason.message : 'Categories could not be loaded.',
          });
        }
      });
    return () => controller.abort();
  }, [key]);

  return {
    data: settled.key === key ? settled.data : [],
    loading: settled.key !== key,
    error: settled.key === key ? settled.error : null,
    retry,
  };
}

export function useCategoryFeatures(categoryId: string): Resource<CategoryFeature[]> {
  const [attempt, setAttempt] = useState(0);
  const key = categoryId ? `${categoryId}:${attempt}` : 'no-category';
  const [settled, setSettled] = useState<SettledResource<CategoryFeature[]>>({
    key: 'no-category',
    data: [],
    error: null,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!categoryId) return;
    const controller = new AbortController();
    void getCategoryFeatures(categoryId, controller.signal)
      .then((data) => setSettled({ key, data, error: null }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({
            key,
            data: [],
            error: reason instanceof Error ? reason.message : 'Filters could not be loaded.',
          });
        }
      });
    return () => controller.abort();
  }, [categoryId, key]);

  const isCurrent = settled.key === key;
  return {
    data: isCurrent ? settled.data : [],
    loading: Boolean(categoryId) && !isCurrent,
    error: isCurrent ? settled.error : null,
    retry,
  };
}

export function usePlaceSearch(state: SearchUrlState): Resource<PlaceSearchResponse | null> {
  const [attempt, setAttempt] = useState(0);
  const key = `${JSON.stringify(state)}:${attempt}`;
  const [settled, setSettled] = useState<SettledResource<PlaceSearchResponse | null>>({
    key: '',
    data: null,
    error: null,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void searchPlaces(toPlaceSearchRequest(state), controller.signal)
      .then((data) => setSettled({ key, data, error: null }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({
            key,
            data: null,
            error: reason instanceof Error ? reason.message : 'Places could not be loaded.',
          });
        }
      });
    return () => controller.abort();
  }, [key, state]);

  const isCurrent = settled.key === key;
  return {
    data: isCurrent ? settled.data : null,
    loading: !isCurrent,
    error: isCurrent ? settled.error : null,
    retry,
  };
}
