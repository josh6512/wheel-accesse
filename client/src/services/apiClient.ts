import type { ApiErrorResponse, DuplicatePlace } from '../types/api';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

let accessToken: string | null = null;
let refreshAccess: (() => Promise<boolean>) | null = null;
let authFailed: (() => void) | null = null;
export const setAuthFailureHandler = (handler: () => void) => {
  authFailed = handler;
};
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setRefreshHandler = (handler: () => Promise<boolean>) => {
  refreshAccess = handler;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly matches?: DuplicatePlace[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  authenticated = false,
): Promise<T> {
  const send = () =>
    fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
        ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  let response = await send();
  if (authenticated && response.status === 401 && refreshAccess && (await refreshAccess())) {
    response = await send();
  }
  if (authenticated && response.status === 401) authFailed?.();

  if (!response.ok) {
    let message = 'The request could not be completed.';
    let code: string | undefined;
    let matches: DuplicatePlace[] | undefined;
    try {
      const body = (await response.json()) as Partial<ApiErrorResponse>;
      if (body.error?.message) message = body.error.message;
      code = body.error?.code;
      matches = body.error?.matches;
    } catch {
      // Keep the safe fallback when the response is not JSON.
    }
    throw new ApiError(message, response.status, code, matches);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}
