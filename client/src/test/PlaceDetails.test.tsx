import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type {
  Category,
  CategoryFeature,
  PaginatedAccessibilityReports,
  PaginatedReviews,
  PlaceDetails,
  PlaceSearchResponse,
} from '../types/api';

const placeId = '77777777-7777-4777-8777-777777777777';
const categoryId = '11111111-1111-4111-8111-111111111111';

const category: Category = {
  id: categoryId,
  code: 'HOTEL',
  displayName: 'Hotel',
  description: null,
  isActive: true,
  displayOrder: 10,
};

const feature = (
  id: string,
  code: string,
  displayName: string,
  valueType: CategoryFeature['valueType'] = 'boolean',
): CategoryFeature => ({
  id,
  code,
  displayName,
  description: `${displayName} description`,
  valueType,
  unit: valueType === 'numeric' ? 'cm' : null,
  isActive: true,
  displayOrder: 10,
  isPrimary: true,
  options: [],
});

const entrance = feature(
  '20000000-0000-4000-8000-000000000001',
  'STEP_FREE_ENTRANCE',
  'Step-free entrance',
);
const toilet = feature(
  '20000000-0000-4000-8000-000000000002',
  'ACCESSIBLE_TOILET',
  'Accessible toilet',
);
const elevator = feature('20000000-0000-4000-8000-000000000003', 'ELEVATOR', 'Elevator');
const parking = feature(
  '20000000-0000-4000-8000-000000000004',
  'ACCESSIBLE_PARKING',
  'Accessible parking',
);
const bedHeight = feature(
  '20000000-0000-4000-8000-000000000005',
  'BED_HEIGHT',
  'Bed height',
  'numeric',
);
const pathSurface = feature(
  '20000000-0000-4000-8000-000000000006',
  'PATH_SURFACE',
  'Path surface',
  'select',
);

const place: PlaceDetails = {
  id: placeId,
  name: 'Harbour View Hotel',
  address: '1 Test Street',
  city: 'Tel Aviv',
  region: 'Central',
  countryCode: 'IL',
  latitude: 32.08,
  longitude: 34.78,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  category: { id: categoryId, code: 'HOTEL', displayName: 'Hotel' },
  media: [],
  reviewCount: 6,
  accessibilityReportCount: 3,
  accessibility: [
    {
      feature: entrance,
      status: 'SUPPORTED',
      positiveReports: 3,
      negativeReports: 1,
    },
    {
      feature: toilet,
      status: 'NOT_SUPPORTED',
      positiveReports: 1,
      negativeReports: 3,
    },
    {
      feature: elevator,
      status: 'CONFLICTING',
      positiveReports: 2,
      negativeReports: 2,
    },
    {
      feature: parking,
      status: 'UNKNOWN',
      positiveReports: 0,
      negativeReports: 0,
    },
  ],
};

const reviews: PaginatedReviews = {
  data: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      body: 'The entrance was easy to find and staff were helpful.',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      place: { id: placeId, name: place.name },
      author: { id: '40000000-0000-4000-8000-000000000001', displayName: 'Ari' },
      media: [],
    },
  ],
  pagination: {
    page: 1,
    pageSize: 5,
    totalItems: 6,
    totalPages: 2,
    hasPreviousPage: false,
    hasNextPage: true,
  },
};

const reports: PaginatedAccessibilityReports = {
  data: [
    {
      id: '50000000-0000-4000-8000-000000000001',
      observedAt: '2026-01-03T00:00:00.000Z',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      place: { id: placeId, name: place.name },
      author: { id: '60000000-0000-4000-8000-000000000001', displayName: 'Hidden reporter' },
      answers: [
        { feature: entrance, value: { type: 'boolean', value: true } },
        { feature: bedHeight, value: { type: 'numeric', value: '55', unit: 'cm' } },
        {
          feature: pathSurface,
          value: {
            type: 'select',
            option: {
              id: '70000000-0000-4000-8000-000000000001',
              code: 'PAVED',
              displayName: 'Paved',
            },
          },
        },
      ],
    },
  ],
  pagination: {
    page: 1,
    pageSize: 5,
    totalItems: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

interface ApiOptions {
  place?: PlaceDetails;
  placeStatus?: number;
  holdPlace?: boolean;
  reviews?: PaginatedReviews;
  failReviews?: boolean;
  reports?: PaginatedAccessibilityReports;
  failReports?: boolean;
}

function installApiMock(options: ApiOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.endsWith('/categories')) return json({ data: [category] });
    if (url.includes(`/categories/${categoryId}/features`)) {
      return json({ data: [entrance, toilet, elevator, parking, bedHeight] });
    }
    if (url.includes(`/places/${placeId}/reviews`)) {
      if (options.failReviews) return json({ error: { message: 'Reviews unavailable.' } }, 503);
      const page = new URL(url).searchParams.get('page');
      if (page === '2') {
        return json({
          data: [
            {
              ...reviews.data[0]!,
              id: '30000000-0000-4000-8000-000000000002',
              body: 'Second page review.',
            },
          ],
          pagination: { ...reviews.pagination, page: 2, hasPreviousPage: true, hasNextPage: false },
        });
      }
      return json(options.reviews ?? reviews);
    }
    if (url.includes(`/places/${placeId}/accessibility-reports`)) {
      if (options.failReports) return json({ error: { message: 'Reports unavailable.' } }, 503);
      return json(options.reports ?? reports);
    }
    if (url.endsWith(`/places/${placeId}`)) {
      if (options.holdPlace) return new Promise<Response>(() => undefined);
      if (options.placeStatus) {
        return json({ error: { message: 'Place request failed.' } }, options.placeStatus);
      }
      return json({ data: options.place ?? place });
    }
    if (url.includes('/places?')) {
      const searchResponse: PlaceSearchResponse = {
        data: [place],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      };
      return json(searchResponse);
    }
    return json({ error: { message: 'Not found.' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderApp(path = `/places/${placeId}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('place details', () => {
  it('renders identity, location, media fallback, every Boolean status, and safe reviews', async () => {
    installApiMock();
    renderApp();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Harbour View Hotel' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hotel')).toBeInTheDocument();
    expect(screen.getByText(/Tel Aviv, Central, IL/)).toBeInTheDocument();
    expect(screen.getByText('1 Test Street')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /No photos for Harbour View Hotel/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Supported by community reports')).toBeInTheDocument();
    expect(screen.getByText('Not supported by community reports')).toBeInTheDocument();
    expect(screen.getByText('Community reports conflict')).toBeInTheDocument();
    expect(screen.getByText('No community information yet')).toBeInTheDocument();
    expect(await screen.findByText(/entrance was easy to find/)).toBeInTheDocument();
    expect(screen.getByText('Ari')).toBeInTheDocument();
    expect(screen.queryByText('Hidden reporter')).not.toBeInTheDocument();
  });

  it('renders supplied public media with meaningful alt text', async () => {
    installApiMock({
      place: {
        ...place,
        media: [
          {
            id: '80000000-0000-4000-8000-000000000001',
            storageReference: 'https://media.example.test/entrance.jpg',
            altText: 'Step-free entrance beside the lobby',
            mimeType: 'image/jpeg',
            displayOrder: 1,
          },
        ],
      },
    });
    renderApp();

    expect(
      await screen.findByRole('img', { name: 'Step-free entrance beside the lobby' }),
    ).toHaveAttribute('src', 'https://media.example.test/entrance.jpg');
    expect(screen.queryByText('Community photos will appear here')).not.toBeInTheDocument();
  });

  it('presents numeric and select observations as evidence without Boolean status labels', async () => {
    installApiMock();
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByText('View community accessibility reports'));
    expect(screen.getByText('55 cm')).toBeInTheDocument();
    expect(screen.getByText('Paved')).toBeInTheDocument();
    expect(screen.getAllByText('Bed height')).toHaveLength(1);
    expect(screen.getAllByText('Path surface')).toHaveLength(1);
    expect(screen.queryByText('Hidden reporter')).not.toBeInTheDocument();
  });

  it('announces loading and handles invalid, missing, and failed place requests', async () => {
    installApiMock({ holdPlace: true });
    const loading = renderApp();
    expect(await screen.findByText('Loading place details.')).toBeInTheDocument();
    loading.unmount();

    const invalidFetch = installApiMock();
    const invalid = renderApp('/places/not-a-uuid');
    expect(screen.getByRole('heading', { name: 'Invalid place link' })).toBeInTheDocument();
    expect(invalidFetch).not.toHaveBeenCalled();
    invalid.unmount();

    installApiMock({ placeStatus: 404 });
    const missing = renderApp();
    expect(await screen.findByRole('heading', { name: 'Place not found' })).toBeInTheDocument();
    missing.unmount();

    installApiMock({ placeStatus: 503 });
    renderApp();
    expect(
      await screen.findByRole('heading', { name: 'We couldn’t load this place' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try place again' })).toBeInTheDocument();
  });

  it('isolates review and accessibility-report failures from the main place page', async () => {
    installApiMock({ failReviews: true, failReports: true });
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Harbour View Hotel' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Reviews could not be loaded/)).toBeInTheDocument();
    await user.click(screen.getByText('View community accessibility reports'));
    expect(await screen.findByText(/Community reports could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText('Community accessibility snapshot')).toBeInTheDocument();
  });

  it('renders empty reviews and paginates a bounded review list accessibly', async () => {
    installApiMock({
      reviews: {
        data: [],
        pagination: {
          page: 1,
          pageSize: 5,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      },
    });
    const empty = renderApp();
    expect(await screen.findByRole('heading', { name: 'No reviews yet' })).toBeInTheDocument();
    empty.unmount();

    installApiMock();
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Next reviews page' }));
    expect(await screen.findByText('Second page review.')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('opens a search card through its keyboard-accessible place link', async () => {
    const fetchMock = installApiMock();
    const user = userEvent.setup();
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);

    const link = await screen.findByRole('link', { name: 'View details for Harbour View Hotel' });
    expect(link).toHaveAttribute('href', `/places/${placeId}`);
    link.focus();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Harbour View Hotel' }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        requestUrl(input as RequestInfo | URL).endsWith(`/places/${placeId}`),
      ),
    ).toBe(true);
  });
});
