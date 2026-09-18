import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { Category, CategoryFeature, PlaceSearchResponse } from '../types/api';

const categoryId = '11111111-1111-4111-8111-111111111111';
const secondCategoryId = '22222222-2222-4222-8222-222222222222';
const entranceId = '33333333-3333-4333-8333-333333333333';
const toiletId = '44444444-4444-4444-8444-444444444444';
const otherFeatureId = '55555555-5555-4555-8555-555555555555';

const categories: Category[] = [
  {
    id: categoryId,
    code: 'hotel',
    displayName: 'Hotels',
    description: null,
    isActive: true,
    displayOrder: 1,
  },
  {
    id: secondCategoryId,
    code: 'museum',
    displayName: 'Museums',
    description: null,
    isActive: true,
    displayOrder: 2,
  },
];

const feature = (
  id: string,
  displayName: string,
  valueType: CategoryFeature['valueType'] = 'boolean',
): CategoryFeature => ({
  id,
  code: displayName.toLowerCase().replaceAll(' ', '-'),
  displayName,
  description: `Community information about ${displayName.toLowerCase()}.`,
  valueType,
  unit: null,
  isActive: true,
  displayOrder: 1,
  isPrimary: true,
  options: [],
});

const hotelFeatures = [
  feature(entranceId, 'Accessible entrance'),
  feature(toiletId, 'Accessible toilet'),
  feature('66666666-6666-4666-8666-666666666666', 'Door width', 'numeric'),
];
const museumFeatures = [feature(otherFeatureId, 'Step-free galleries')];

const result: PlaceSearchResponse = {
  data: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Harbour View Hotel',
      address: '1 Test Street',
      city: 'Tel Aviv',
      region: null,
      countryCode: 'IL',
      latitude: 32.08,
      longitude: 34.78,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      category: { id: categoryId, code: 'hotel', displayName: 'Hotels' },
      accessibility: [
        {
          feature: {
            id: entranceId,
            code: 'accessible-entrance',
            displayName: 'Accessible entrance',
          },
          status: 'SUPPORTED',
          positiveReports: 3,
          negativeReports: 1,
        },
        {
          feature: { id: toiletId, code: 'accessible-toilet', displayName: 'Accessible toilet' },
          status: 'UNKNOWN',
          positiveReports: 0,
          negativeReports: 0,
        },
      ],
      reviewCount: 4,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 21,
    totalPages: 2,
    hasPreviousPage: false,
    hasNextPage: true,
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

function placeRequestUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => requestUrl(input as RequestInfo | URL))
    .filter((url) => url.includes('/places?'));
}

function installApiMock(options?: {
  placeResponse?: PlaceSearchResponse;
  failPlacesOnce?: boolean;
  holdPlaces?: boolean;
}) {
  let failed = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.endsWith('/categories')) return json({ data: categories });
    if (url.includes(`/categories/${categoryId}/features`)) return json({ data: hotelFeatures });
    if (url.includes(`/categories/${secondCategoryId}/features`)) {
      return json({ data: museumFeatures });
    }
    if (url.includes('/places?')) {
      if (options?.holdPlaces) return new Promise<Response>(() => undefined);
      if (options?.failPlacesOnce && !failed) {
        failed = true;
        return json({ error: { message: 'Search is temporarily unavailable.' } }, 503);
      }
      return json(options?.placeResponse ?? result);
    }
    return json({ error: { message: 'Not found' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderApp(path = '/') {
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

describe('home search', () => {
  it('loads category options and submits search state to the results API', async () => {
    const fetchMock = installApiMock();
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByRole('option', { name: 'Hotels' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'City' }), 'Tel Aviv');
    await user.type(screen.getByRole('textbox', { name: 'Country (optional)' }), 'il');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), categoryId);
    await user.type(screen.getByRole('textbox', { name: 'Place name (optional)' }), 'Harbour');
    await user.click(screen.getByRole('button', { name: 'Search places' }));

    expect(await screen.findByRole('heading', { name: 'Harbour View Hotel' })).toBeInTheDocument();
    const placeUrl = new URL(placeRequestUrls(fetchMock).at(-1)!);
    expect(placeUrl.searchParams.get('city')).toBe('Tel Aviv');
    expect(placeUrl.searchParams.get('country')).toBe('IL');
    expect(placeUrl.searchParams.get('category')).toBe(categoryId);
    expect(placeUrl.searchParams.get('q')).toBe('Harbour');
  });

  it('restores editable search controls from URL state', async () => {
    installApiMock();
    renderApp(`/search?city=Haifa&country=il&category=${categoryId}&q=Bay`);

    expect(await screen.findByRole('heading', { name: 'Harbour View Hotel' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'City' })).toHaveValue('Haifa');
    expect(screen.getByRole('textbox', { name: 'Country (optional)' })).toHaveValue('IL');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue(categoryId);
    expect(screen.getByRole('textbox', { name: 'Place name (optional)' })).toHaveValue('Bay');
  });
});

describe('dynamic accessibility search', () => {
  it('renders only Boolean category features and sends multiple selections with AND syntax', async () => {
    const fetchMock = installApiMock();
    const user = userEvent.setup();
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);

    const entrance = await screen.findByRole('checkbox', { name: /Accessible entrance/ });
    const toilet = screen.getByRole('checkbox', { name: /Accessible toilet/ });
    expect(screen.queryByRole('checkbox', { name: /Door width/ })).not.toBeInTheDocument();
    await user.click(entrance);
    await user.click(toilet);

    await waitFor(() => {
      const url = new URL(placeRequestUrls(fetchMock).at(-1)!);
      expect(url.searchParams.get('features')).toBe(`${entranceId}:true,${toiletId}:true`);
    });
  });

  it('removes category-specific filters when the category changes', async () => {
    const fetchMock = installApiMock();
    const user = userEvent.setup();
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}&features=${entranceId}:true`);

    expect(await screen.findByRole('checkbox', { name: /Accessible entrance/ })).toBeChecked();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), secondCategoryId);
    await user.click(screen.getByRole('button', { name: 'Update search' }));

    expect(
      await screen.findByRole('checkbox', { name: /Step-free galleries/ }),
    ).toBeInTheDocument();
    await waitFor(() => {
      const url = new URL(placeRequestUrls(fetchMock).at(-1)!);
      expect(url.searchParams.get('category')).toBe(secondCategoryId);
      expect(url.searchParams.has('features')).toBe(false);
    });
  });

  it('preserves filters when changing pages', async () => {
    const fetchMock = installApiMock();
    const user = userEvent.setup();
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}&features=${entranceId}:true`);

    expect(await screen.findByRole('heading', { name: 'Harbour View Hotel' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Go to page 2' }));

    await waitFor(() => {
      const url = new URL(placeRequestUrls(fetchMock).at(-1)!);
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('features')).toBe(`${entranceId}:true`);
    });
  });

  it('opens a focus-managed filter dialog and closes it with Escape', async () => {
    installApiMock();
    const user = userEvent.setup();
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);

    const button = await screen.findByRole('button', { name: 'Filters' });
    await user.click(button);
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close filters' })).toHaveFocus();
    expect(document.querySelector('.app-shell > main')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(document.querySelector('.app-shell > main')).not.toHaveAttribute('inert');
  });
});

describe('search result states', () => {
  it('renders cards and never renders private reporter data from an over-broad response', async () => {
    installApiMock({
      placeResponse: {
        ...result,
        data: [
          {
            ...result.data[0]!,
            reporterEmail: 'private@example.test',
            userId: 'private-user',
          } as (typeof result.data)[number],
        ],
      },
    });
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);

    expect(await screen.findByRole('heading', { name: 'Harbour View Hotel' })).toBeInTheDocument();
    expect(screen.getAllByText('Accessible entrance')).toHaveLength(2);
    expect(screen.getByText(/Based on community reports/)).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('private-user')).not.toBeInTheDocument();
  });

  it('announces loading and renders an empty result state', async () => {
    installApiMock({ holdPlaces: true });
    const loadingView = renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);
    expect(await screen.findByText('Loading search results.')).toBeInTheDocument();
    loadingView.unmount();

    installApiMock({
      placeResponse: {
        data: [],
        pagination: { ...result.pagination, totalItems: 0, totalPages: 0, hasNextPage: false },
      },
    });
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);
    expect(
      await screen.findByRole('heading', { name: 'No matching places found' }),
    ).toBeInTheDocument();
  });

  it('shows a safe error with a working retry action', async () => {
    installApiMock({ failPlacesOnce: true });
    const user = userEvent.setup();
    renderApp(`/search?city=Tel%20Aviv&category=${categoryId}`);

    expect(
      await screen.findByRole('heading', { name: 'We couldn’t load these places' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try search again' }));
    expect(await screen.findByRole('heading', { name: 'Harbour View Hotel' })).toBeInTheDocument();
  });
});
