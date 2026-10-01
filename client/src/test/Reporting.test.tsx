import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/useAuth';
import { ReportAction } from '../components/reporting/ReportAction';
import { PlaceGallery } from '../components/places/PlaceGallery';
import { ReviewList } from '../components/reviews/ReviewList';
import { setAccessToken } from '../services/apiClient';
import type { PublicMedia, PublicReview } from '../types/api';

const placeId = '11111111-1111-4111-8111-111111111111';
const reviewId = '22222222-2222-4222-8222-222222222222';
const mediaId = '33333333-3333-4333-8333-333333333333';
const actor = {
  id: '44444444-4444-4444-8444-444444444444',
  displayName: 'Test reporter',
  email: 'reporter@example.test',
};
const media: PublicMedia = {
  id: mediaId,
  storageReference: `https://example.test/api/v1/media/${mediaId}`,
  mimeType: 'image/webp',
  altText: 'Entrance photo',
  displayOrder: 0,
};
const review: PublicReview = {
  id: reviewId,
  body: 'A synthetic review',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  place: { id: placeId, name: 'Test place' },
  author: { id: '55555555-5555-4555-8555-555555555555', displayName: 'Other reviewer' },
  media: [media],
};
const reportAction = (
  targetType: 'PLACE' | 'REVIEW' | 'PLACE_MEDIA' | 'REVIEW_MEDIA' = 'PLACE',
  targetId = placeId,
) => (
  <ReportAction
    placeId={placeId}
    targetType={targetType}
    targetId={targetId}
    label={`Report ${targetType.toLowerCase().replace('_', ' ')}`}
  />
);
function LocationDisplay() {
  const location = useLocation();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
    </p>
  );
}
function view(child: React.ReactNode, signedIn = true) {
  return render(
    <MemoryRouter initialEntries={[`/places/${placeId}`]}>
      <AuthContext.Provider
        value={{
          user: signedIn ? actor : null,
          restoring: false,
          authenticate: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <Routes>
          <Route
            path="/places/:placeId"
            element={
              <>
                {child}
                <LocationDisplay />
              </>
            }
          />
          <Route path="/login" element={<LocationDisplay />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
const success = () =>
  new Response(JSON.stringify({ data: { id: 'report-id', status: 'OPEN' } }), { status: 201 });
const successfulFetch = () =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return success();
  });
const failure = (status: number) =>
  new Response(JSON.stringify({ error: { message: 'Raw API detail', code: 'INTERNAL' } }), {
    status,
  });
beforeEach(() => setAccessToken('synthetic-access-token'));
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

it('sends anonymous reporters to safe place sign-in return path', async () => {
  view(reportAction(), false);
  const link = screen.getByRole('link', { name: /Report place; sign in/ });
  expect(link).toHaveAttribute(
    'href',
    `/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`,
  );
  await userEvent.setup().click(link);
  expect(screen.getByTestId('location')).toHaveTextContent(
    `/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`,
  );
});

it('submits selected reason and trimmed optional details through the typed service', async () => {
  const fetcher = successfulFetch();
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  view(reportAction());
  const trigger = screen.getByRole('button', { name: 'Report place' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Report place' });
  expect(within(dialog).getByLabelText('Reason')).toHaveFocus();
  await user.selectOptions(within(dialog).getByLabelText('Reason'), 'INCORRECT_INFORMATION');
  await user.type(within(dialog).getByLabelText('Details (optional)'), '  Wrong address  ');
  await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('Thanks. Your report was submitted.')).toBeInTheDocument();
  expect(trigger).toHaveFocus();
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toMatch(/\/reports$/);
  expect(init?.method).toBe('POST');
  expect(init?.headers).toMatchObject({ Authorization: 'Bearer synthetic-access-token' });
  expect(JSON.parse(String(init?.body))).toEqual({
    targetType: 'PLACE',
    targetId: placeId,
    reason: 'INCORRECT_INFORMATION',
    details: 'Wrong address',
  });
  expect(screen.queryByText('INCORRECT_INFORMATION')).not.toBeInTheDocument();
});

it('omits blank optional details and Escape closes with focus restored', async () => {
  const fetcher = successfulFetch();
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  view(reportAction());
  const trigger = screen.getByRole('button', { name: 'Report place' });
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.selectOptions(screen.getByLabelText('Reason'), 'SPAM');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
    targetType: 'PLACE',
    targetId: placeId,
    reason: 'SPAM',
  });
});

it('keeps keyboard Tab focus inside the report dialog', async () => {
  const user = userEvent.setup();
  view(reportAction());
  await user.click(screen.getByRole('button', { name: 'Report place' }));
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  cancel.focus();
  await user.keyboard('{Tab}');
  expect(screen.getByLabelText('Reason')).toHaveFocus();
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  expect(cancel).toHaveFocus();
});

it('shows a safe connection error without exposing internals', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('Network stack detail');
    }),
  );
  const user = userEvent.setup();
  view(reportAction());
  await user.click(screen.getByRole('button', { name: 'Report place' }));
  await user.selectOptions(screen.getByLabelText('Reason'), 'SPAM');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please check your connection');
  expect(screen.queryByText('Network stack detail')).not.toBeInTheDocument();
});

for (const [status, message] of [
  [403, 'You cannot report this content.'],
  [404, 'This content is no longer available.'],
  [409, 'You already reported this content for that reason.'],
  [429, 'Too many reports. Please try again later.'],
  [400, 'Check the reason and details, then try again.'],
] as const)
  it(`shows a safe ${status} error without closing the dialog`, async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failure(status)),
    );
    const user = userEvent.setup();
    view(reportAction());
    await user.click(screen.getByRole('button', { name: 'Report place' }));
    await user.selectOptions(screen.getByLabelText('Reason'), 'SPAM');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Raw API detail')).not.toBeInTheDocument();
  });

it('routes an expired session to sign-in for the same place', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => failure(401)),
  );
  const user = userEvent.setup();
  view(reportAction());
  await user.click(screen.getByRole('button', { name: 'Report place' }));
  await user.selectOptions(screen.getByLabelText('Reason'), 'SPAM');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByTestId('location')).toHaveTextContent(
    `/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`,
  );
});

it('offers review and review-photo reporting but hides both for the known author', async () => {
  const fetcher = successfulFetch();
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  const props = {
    reviews: {
      data: [review],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    },
    loading: false,
    error: null,
    onRetry: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  };
  const rendered = view(<ReviewList {...props} />);
  await user.click(screen.getByRole('button', { name: 'Report review by Other reviewer' }));
  await user.selectOptions(screen.getByLabelText('Reason'), 'SPAM');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
    targetType: 'REVIEW',
    targetId: reviewId,
  });
  await user.click(
    screen.getByRole('button', { name: 'Report photo 1 in review by Other reviewer' }),
  );
  await user.selectOptions(screen.getByLabelText('Reason'), 'INAPPROPRIATE_MEDIA');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toMatchObject({
    targetType: 'REVIEW_MEDIA',
    targetId: mediaId,
  });
  rendered.unmount();
  view(
    <ReviewList {...props} reviews={{ ...props.reviews, data: [{ ...review, author: actor }] }} />,
  );
  expect(screen.queryByRole('button', { name: /Report review by/ })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Report photo 1 in review/ }),
  ).not.toBeInTheDocument();
});

it('reports individual place media with the media asset ID', async () => {
  const fetcher = successfulFetch();
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  view(<PlaceGallery media={[media]} placeName="Test place" placeId={placeId} />);
  await user.click(screen.getByRole('button', { name: 'Report place photo 1' }));
  await user.selectOptions(screen.getByLabelText('Reason'), 'OTHER');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
    targetType: 'PLACE_MEDIA',
    targetId: mediaId,
  });
});
