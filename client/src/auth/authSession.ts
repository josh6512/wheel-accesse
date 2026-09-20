import {
  apiRequest,
  setAccessToken,
  setRefreshHandler,
  setAuthFailureHandler,
} from '../services/apiClient';

export interface AuthUser {
  id: string;
  displayName: string | null;
  email: string | null;
}
interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}
interface AuthState {
  user: AuthUser | null;
  restoring: boolean;
}
let state: AuthState = { user: null, restoring: true };
const listeners = new Set<() => void>();
export const subscribeAuth = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getAuthState = () => state;
function publish(user: AuthUser | null) {
  state = { user, restoring: false };
  listeners.forEach((listener) => listener());
}
function clear() {
  setAccessToken(null);
  publish(null);
}
// Web Locks serialize cookie rotation across tabs of this frontend origin.
let localQueue: Promise<unknown> = Promise.resolve();
function cookieOperation<T>(operation: () => Promise<T>): Promise<T> {
  const run = localQueue.then(() =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('wheel-accesses-auth', operation)
      : operation(),
  );
  localQueue = run.catch(() => undefined);
  return run;
}
const post = <T>(path: string, body?: unknown) =>
  apiRequest<T>(`/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
let refreshPromise: Promise<boolean> | null = null;
let generation = 0;
export function restoreSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const started = generation;
  refreshPromise = cookieOperation(async () => {
    if (started !== generation) return false;
    try {
      const result = await post<AuthResponse>('refresh');
      if (started !== generation) return false;
      setAccessToken(result.accessToken);
      publish(result.user);
      return true;
    } catch {
      if (started === generation) clear();
      return false;
    }
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
setRefreshHandler(restoreSession);
setAuthFailureHandler(clear);

export async function authenticate(
  mode: 'login' | 'register',
  input: { email: string; password: string; displayName?: string },
) {
  generation++;
  await cookieOperation(async () => {
    const result = await post<AuthResponse>(mode, input);
    setAccessToken(result.accessToken);
    publish(result.user);
  });
}
export const currentUser = () => apiRequest<AuthUser>('/auth/me', undefined, true);
export async function logout() {
  generation++;
  await cookieOperation(async () => {
    await post<void>('logout');
    clear();
  });
}
