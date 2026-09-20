import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider';
import {
  authenticate,
  currentUser,
  getAuthState,
  logout,
  restoreSession,
} from '../auth/authSession';
import { AuthPage } from '../pages/AuthPage';
import { AppShell } from '../components/AppShell';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Test Visitor',
  email: 'visitor@example.test',
};
const session = { user, accessToken: 'test-memory-token', expiresIn: 600 };
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => json({ error: { message: 'Please sign in to continue.' } }, 401);
beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await logout();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function renderAuth(mode: 'login' | 'register') {
  render(
    <MemoryRouter initialEntries={[`/${mode}`]}>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path={`/${mode}`} element={<AuthPage mode={mode} />} />
            <Route path="/" element={<h1>Explore places</h1>} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </MemoryRouter>,
  );
}
it('registers through the service, shows account state and writes no browser storage', async () => {
  const local = vi.spyOn(Storage.prototype, 'setItem');
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    String(input).endsWith('/refresh') ? unauthorized() : json(session, 201),
  );
  vi.stubGlobal('fetch', fetchMock);
  renderAuth('register');
  const actor = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled());
  await actor.type(screen.getByLabelText('Display name'), 'Test Visitor');
  await actor.type(screen.getByLabelText('Email'), user.email);
  await actor.type(screen.getByLabelText('Password'), 'a long test passphrase');
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('heading', { name: 'Explore places' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Your account' })).toHaveTextContent('Test Visitor');
  expect(local).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/register'))).toBe(true);
});
it('presents generic login failures and lets the user retry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/refresh')
        ? unauthorized()
        : json({ error: { message: 'Email or password is incorrect.' } }, 401),
    ),
  );
  renderAuth('login');
  const actor = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
  await actor.type(screen.getByLabelText('Email'), user.email);
  await actor.type(screen.getByLabelText('Password'), 'wrong');
  await actor.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});
it('restores from the HttpOnly cookie and attaches memory token to protected requests', async () => {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/refresh')) {
      expect(init?.credentials).toBe('include');
      return json(session);
    }
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${session.accessToken}`);
    return json(user);
  });
  vi.stubGlobal('fetch', mock);
  expect(await restoreSession()).toBe(true);
  expect(getAuthState().user).toEqual(user);
  expect(await currentUser()).toEqual(user);
});
it('coalesces concurrent expiration into one refresh and retries each request once', async () => {
  let refreshed = false,
    refreshes = 0,
    requests = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/refresh')) {
        refreshes++;
        refreshed = true;
        return json(session);
      }
      requests++;
      return refreshed ? json(user) : unauthorized();
    }),
  );
  await Promise.all([currentUser(), currentUser()]);
  expect(refreshes).toBe(1);
  expect(requests).toBe(4);
});
it('failed refresh clears account state and never loops', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json(session)),
  );
  await authenticate('login', { email: user.email, password: 'test' });
  const mock = vi.fn(async () => unauthorized());
  vi.stubGlobal('fetch', mock);
  await expect(currentUser()).rejects.toMatchObject({ status: 401 });
  expect(mock).toHaveBeenCalledTimes(2);
  expect(getAuthState().user).toBeNull();
});
it('a rejected retry also clears account state without refreshing twice', async () => {
  const mock = vi.fn(async (input: RequestInfo | URL) =>
    String(input).endsWith('/refresh') ? json(session) : unauthorized(),
  );
  vi.stubGlobal('fetch', mock);
  await expect(currentUser()).rejects.toMatchObject({ status: 401 });
  expect(mock).toHaveBeenCalledTimes(3);
  expect(getAuthState().user).toBeNull();
});
it('logout waits for server revocation then clears memory; failures remain retryable', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json(session)),
  );
  await authenticate('login', { email: user.email, password: 'test' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({}, 500)),
  );
  await expect(logout()).rejects.toThrow();
  expect(getAuthState().user).toEqual(user);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await logout();
  expect(getAuthState().user).toBeNull();
});
