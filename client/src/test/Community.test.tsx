import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthContext } from '../auth/useAuth';
import { authenticate, getAuthState, logout } from '../auth/authSession';
import { setAccessToken } from '../services/apiClient';
import { AddPlacePage } from '../pages/AddPlacePage';
import { ReviewComposer } from '../components/community/ReviewComposer';
import { ReviewList } from '../components/reviews/ReviewList';
import { AccessibilityContribution } from '../components/community/AccessibilityContribution';
import { AuthPage } from '../pages/AuthPage';
import type { CategoryFeature, PaginatedReviews } from '../types/api';

const categoryId = '11111111-1111-4111-8111-111111111111';
const secondCategory = '11111111-1111-4111-8111-111111111112';
const placeId = '22222222-2222-4222-8222-222222222222';
const user = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Test author',
  email: 'private@example.test',
};
const features: CategoryFeature[] = ['boolean', 'numeric', 'select', 'text'].map((type, index) => ({
  id: `40000000-0000-4000-8000-00000000000${index}`,
  code: `TYPE_${index}`,
  displayName: ['Entrance', 'Door width', 'Surface', 'Observation'][index]!,
  description: null,
  valueType: type as CategoryFeature['valueType'],
  unit: type === 'numeric' ? 'cm' : null,
  isActive: true,
  displayOrder: index,
  isPrimary: true,
  options:
    type === 'select'
      ? [
          {
            id: '50000000-0000-4000-8000-000000000001',
            code: 'PAVED',
            displayName: 'Paved',
            displayOrder: 1,
            isActive: true,
          },
        ]
      : [],
}));
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function api(
  options: {
    duplicate?: boolean;
    failReview?: number;
    failReport?: number;
    network?: boolean;
  } = {},
) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/categories'))
      return json({
        data: [
          { id: categoryId, displayName: 'Configured category' },
          { id: secondCategory, displayName: 'Other category' },
        ],
      });
    if (path.endsWith(`/categories/${categoryId}/features`)) return json({ data: features });
    if (path.endsWith(`/categories/${secondCategory}/features`)) return json({ data: [] });
    if (init?.method === 'POST' && path.endsWith('/places')) {
      if (options.network) throw new TypeError('Network unavailable');
      if (options.duplicate)
        return json(
          {
            error: {
              code: 'POSSIBLE_DUPLICATE_PLACE',
              message: 'We found similar places',
              matches: [
                {
                  id: placeId,
                  name: 'Existing place',
                  city: 'Test city',
                  countryCode: 'IL',
                  address: null,
                },
              ],
            },
          },
          409,
        );
      return json({ data: { id: placeId, name: 'New place' } }, 201);
    }
    if (path.endsWith('/reviews') && options.failReview)
      return json({ error: { message: 'Review request failed.' } }, options.failReview);
    if (path.endsWith('/accessibility-reports') && options.failReport)
      return json({ error: { message: 'Report request failed.' } }, options.failReport);
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return json({ data: { id: 'saved-contribution' } }, 201);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
function view(node: ReactNode, signedIn = true, route = '/places/new') {
  return render(
    <AuthContext.Provider
      value={{
        ...getAuthState(),
        user: signedIn ? user : null,
        restoring: false,
        authenticate,
        logout,
      }}
    >
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<h1>Sign in destination</h1>} />
          <Route path="*" element={node} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
async function fillPlace(actor: ReturnType<typeof userEvent.setup>) {
  await actor.type(screen.getByLabelText('Place name'), 'New place');
  await actor.selectOptions(await screen.findByLabelText('Category'), categoryId);
  await actor.type(screen.getByLabelText('City'), 'Test city');
  await actor.type(screen.getByLabelText('Country (two-letter code)'), 'IL');
  await screen.findByLabelText('Entrance');
}
beforeEach(() => {
  setAccessToken('synthetic-memory-token');
});
afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('protects Add Place and directs unauthenticated visitors to sign in', async () => {
  const mock = api();
  view(<AddPlacePage />, false);
  expect(await screen.findByRole('heading', { name: 'Sign in destination' })).toBeInTheDocument();
  expect(mock).not.toHaveBeenCalled();
});
it('loads categories/features dynamically and renders all four accessible input kinds with explicit unknown', async () => {
  const mock = api();
  const actor = userEvent.setup();
  view(<AddPlacePage />);
  expect(await screen.findByRole('option', { name: 'Configured category' })).toBeInTheDocument();
  await fillPlace(actor);
  expect(screen.getByLabelText('Entrance')).toHaveValue('');
  expect(screen.getByRole('spinbutton', { name: 'Door width (cm)' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Surface' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Observation' })).toBeInTheDocument();
  screen.getByLabelText('Entrance').focus();
  expect(screen.getByLabelText('Entrance')).toHaveFocus();
  await actor.tab();
  expect(screen.getByLabelText('Door width (cm)')).toHaveFocus();
  expect(
    mock.mock.calls.some(([url]) => String(url).includes(`/categories/${categoryId}/features`)),
  ).toBe(true);
});
it('changing category reloads questions and clears stale answers', async () => {
  api();
  const actor = userEvent.setup();
  view(<AddPlacePage />);
  await fillPlace(actor);
  await actor.selectOptions(screen.getByLabelText('Entrance'), 'true');
  await actor.selectOptions(screen.getByLabelText('Category'), secondCategory);
  await waitFor(() => expect(screen.queryByLabelText('Entrance')).not.toBeInTheDocument());
  await actor.selectOptions(screen.getByLabelText('Category'), categoryId);
  expect(await screen.findByLabelText('Entrance')).toHaveValue('');
});
it('creates a place then report and review with memory bearer token, omitting unknown observations', async () => {
  const mock = api();
  const actor = userEvent.setup();
  view(<AddPlacePage />);
  await fillPlace(actor);
  await actor.selectOptions(screen.getByLabelText('Entrance'), 'false');
  await actor.type(screen.getByLabelText('Door width (cm)'), '82.5');
  await actor.selectOptions(screen.getByLabelText('Surface'), features[2]!.options[0]!.id);
  await actor.type(
    screen.getByLabelText('Share your experience (optional)'),
    'Plain initial review',
  );
  await actor.click(screen.getByRole('button', { name: 'Create place' }));
  expect(await screen.findByText('Place created successfully.')).toBeInTheDocument();
  expect(screen.getByText('Accessibility information saved.')).toBeInTheDocument();
  expect(screen.getByText('Review published.')).toBeInTheDocument();
  const writes = mock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(writes.map(([url]) => new URL(String(url)).pathname)).toEqual([
    '/api/v1/places',
    `/api/v1/places/${placeId}/accessibility-reports`,
    `/api/v1/places/${placeId}/reviews`,
  ]);
  for (const [, init] of writes)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-memory-token');
  const report = JSON.parse(String(writes[1]![1]!.body)) as { answers: unknown[] };
  expect(report.answers).toHaveLength(3);
  expect(report.answers[0]).toMatchObject({ type: 'boolean', value: false });
  expect(JSON.stringify(writes).includes(user.email)).toBe(false);
});
it('duplicate results link to existing places without a client bypass or follow-up writes', async () => {
  const mock = api({ duplicate: true });
  const actor = userEvent.setup();
  view(<AddPlacePage />);
  await fillPlace(actor);
  await actor.click(screen.getByRole('button', { name: 'Create place' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('We found similar places');
  expect(screen.getByRole('link', { name: 'Existing place' })).toHaveAttribute(
    'href',
    `/places/${placeId}`,
  );
  expect(screen.queryByRole('button', { name: /override/i })).not.toBeInTheDocument();
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});
it('reports partial follow-up failures honestly without deleting or recreating the place', async () => {
  const mock = api({ failReview: 503 });
  const actor = userEvent.setup();
  view(<AddPlacePage />);
  await fillPlace(actor);
  await actor.selectOptions(screen.getByLabelText('Entrance'), 'true');
  await actor.type(screen.getByLabelText('Share your experience (optional)'), 'Review');
  await actor.click(screen.getByRole('button', { name: 'Create place' }));
  expect(await screen.findByText(/Review was not confirmed published/)).toBeInTheDocument();
  expect(screen.getByText('Place created successfully.')).toBeInTheDocument();
  expect(screen.getByText('Accessibility information saved.')).toBeInTheDocument();
  expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
});
it('network uncertainty keeps entered content and tells users to check before retrying', async () => {
  api({ network: true });
  const actor = userEvent.setup();
  view(<AddPlacePage />);
  await fillPlace(actor);
  await actor.click(screen.getByRole('button', { name: 'Create place' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check the place before retrying');
  expect(screen.getByLabelText('Place name')).toHaveValue('New place');
});
it('unauthenticated review composer offers a safe return destination and no form', () => {
  view(<ReviewComposer placeId={placeId} onSaved={vi.fn()} />, false);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in to write a review' })).toHaveAttribute(
    'href',
    `/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`,
  );
});
it('review composer publishes plain text, clears input and signals reload', async () => {
  const mock = api(),
    saved = vi.fn();
  const actor = userEvent.setup();
  view(<ReviewComposer placeId={placeId} onSaved={saved} />);
  await actor.type(screen.getByLabelText('Your review'), '<b>Plain text</b>');
  await actor.click(screen.getByRole('button', { name: 'Publish review' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith('Review published.'));
  expect(screen.getByLabelText('Your review')).toHaveValue('');
  expect(JSON.parse(String(mock.mock.calls[0]![1]!.body))).toEqual({ body: '<b>Plain text</b>' });
});
it.each([400, 403, 429])(
  'review composer exposes accessible %s errors and preserves the draft',
  async (status) => {
    api({ failReview: status });
    const actor = userEvent.setup();
    view(<ReviewComposer placeId={placeId} onSaved={vi.fn()} />);
    await actor.type(screen.getByLabelText('Your review'), 'Preserved');
    await actor.click(screen.getByRole('button', { name: 'Publish review' }));
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
    expect(screen.getByLabelText('Your review')).toHaveValue('Preserved');
  },
);
const reviews: PaginatedReviews = {
  data: [
    {
      id: 'own-review',
      body: 'My review',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      place: { id: placeId, name: 'Place' },
      author: { id: user.id, displayName: 'Owner' },
      media: [],
    },
    {
      id: 'other-review',
      body: 'Their review',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      place: { id: placeId, name: 'Place' },
      author: { id: 'other-user', displayName: 'Other' },
      media: [],
    },
  ],
  pagination: {
    page: 1,
    pageSize: 5,
    totalItems: 2,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
};
it('only owners see controls; edits save and deletion requires confirmation', async () => {
  const mock = api(),
    saved = vi.fn();
  const actor = userEvent.setup();
  view(
    <ReviewList
      reviews={reviews}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onSaved={saved}
    />,
  );
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
  const other = screen.getByText('Their review').closest('article')!;
  expect(within(other).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  await actor.click(screen.getByRole('button', { name: 'Edit' }));
  await actor.clear(screen.getByLabelText('Edit your review'));
  await actor.type(screen.getByLabelText('Edit your review'), 'Changed');
  await actor.click(screen.getByRole('button', { name: 'Save review' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith('Review updated.'));
  await actor.click(screen.getByRole('button', { name: 'Delete' }));
  expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  await actor.click(screen.getByRole('button', { name: 'Confirm delete review' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith('Review deleted.'));
});
it('accessibility contribution accepts a partial report separately from reviews', async () => {
  const mock = api(),
    saved = vi.fn(),
    created = vi.fn();
  const actor = userEvent.setup();
  view(
    <AccessibilityContribution
      placeId={placeId}
      categoryId={categoryId}
      onSaved={saved}
      recentReportId={null}
      onReportCreated={created}
    />,
  );
  await actor.click(screen.getByRole('button', { name: 'Add accessibility observation' }));
  await actor.selectOptions(await screen.findByLabelText('Entrance'), 'false');
  await actor.click(screen.getByRole('button', { name: 'Save accessibility information' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith('Accessibility information saved.'));
  expect(created).toHaveBeenCalledWith('saved-contribution');
  const write = mock.mock.calls.find(([, init]) => init?.method === 'POST')!;
  expect(JSON.parse(String(write[1]!.body))).toEqual({
    answers: [{ featureId: features[0]!.id, type: 'boolean', value: false }],
  });
});
it('accessibility contribution requires one known answer and confirms own latest report deletion', async () => {
  const mock = api(),
    saved = vi.fn();
  const actor = userEvent.setup();
  view(
    <AccessibilityContribution
      placeId={placeId}
      categoryId={categoryId}
      onSaved={saved}
      recentReportId="own-report"
      onReportCreated={vi.fn()}
    />,
  );
  await actor.click(screen.getByRole('button', { name: 'Add accessibility observation' }));
  await screen.findByLabelText('Entrance');
  await actor.click(screen.getByRole('button', { name: 'Save accessibility information' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('at least one');
  await actor.click(screen.getByRole('button', { name: 'Delete my latest report' }));
  expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  await actor.click(screen.getByRole('button', { name: 'Confirm delete report' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith('Accessibility report deleted.'));
});
it('auth return destinations reject external redirects', async () => {
  render(
    <AuthContext.Provider
      value={{ ...getAuthState(), user, restoring: false, authenticate, logout }}
    >
      <MemoryRouter initialEntries={['/login?returnTo=https://attacker.example']}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/" element={<h1>Safe home</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  expect(await screen.findByRole('heading', { name: 'Safe home' })).toBeInTheDocument();
});
