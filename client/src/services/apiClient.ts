import type { ApiErrorResponse } from '../types/api';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = 'The request could not be completed.';
    try {
      const body = (await response.json()) as Partial<ApiErrorResponse>;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Keep the safe fallback when the response is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
