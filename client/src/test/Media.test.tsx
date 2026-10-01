import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImagePicker } from '../components/media/ImagePicker';
import { MediaManager } from '../components/media/MediaManager';
import { PlaceGallery } from '../components/places/PlaceGallery';
import { ReviewComposer } from '../components/community/ReviewComposer';
import { ReviewList } from '../components/reviews/ReviewList';
import { AddPlacePage } from '../pages/AddPlacePage';
import { AuthContext } from '../auth/useAuth';
import { setAccessToken } from '../services/apiClient';
import { addPlaceWithContributions } from '../services/communityService';
import { uploadImages, type SelectedImage } from '../services/mediaService';
import type { PublicMedia, PublicReview } from '../types/api';

const actor = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Synthetic',
  email: 'synthetic@example.test',
};
const placeId = '22222222-2222-4222-8222-222222222222',
  categoryId = '11111111-1111-4111-8111-111111111111';
const media: PublicMedia = {
  id: 'image-id',
  storageReference: 'http://localhost:3000/api/v1/media/image-id',
  mimeType: 'image/webp',
  altText: 'Step-free doorway',
  displayOrder: 0,
};
const file = () => new File(['synthetic image bytes'], 'test.png', { type: 'image/png' });
const selected = (): SelectedImage => ({
  id: crypto.randomUUID(),
  file: file(),
  altText: 'Doorway',
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const review: PublicReview = {
  id: 'review-id',
  body: 'Synthetic review',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  author: actor,
  place: { id: placeId, name: 'Synthetic place' },
  media: [media],
};
function view(child: ReactNode) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ user: actor, restoring: false, authenticate: vi.fn(), logout: vi.fn() }}
      >
        {child}
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
function Picker({ limit = 3 }: { limit?: number }) {
  const [images, setImages] = useState<SelectedImage[]>([]);
  return <ImagePicker images={images} onChange={setImages} limit={limit} />;
}
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:synthetic-preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  setAccessToken('synthetic-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setAccessToken(null);
});

it('selection creates a local preview but no request; keyboard removal revokes it', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  view(<Picker />);
  await user.upload(screen.getByLabelText('Choose images'), file());
  expect(screen.getByAltText('Selected image preview: test.png')).toHaveAttribute(
    'src',
    'blob:synthetic-preview',
  );
  expect(fetcher).not.toHaveBeenCalled();
  const remove = screen.getByRole('button', { name: 'Remove selected image 1' });
  remove.focus();
  await user.keyboard('{Enter}');
  expect(screen.queryByAltText('Selected image preview: test.png')).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-preview');
});
it('unmount revokes object URLs and optional alt text is editable', async () => {
  const user = userEvent.setup();
  const result = view(<Picker />);
  await user.upload(screen.getByLabelText('Choose images'), file());
  await user.type(screen.getByLabelText('Image 1 description (optional)'), 'A wide doorway');
  expect(screen.getByLabelText('Image 1 description (optional)')).toHaveValue('A wide doorway');
  result.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
});
it('invalid files, oversized files and too many images get accessible errors', async () => {
  const user = userEvent.setup({ applyAccept: false });
  view(<Picker limit={1} />);
  const input = screen.getByLabelText('Choose images');
  await user.upload(input, new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' }));
  expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG or WebP');
  await user.upload(
    input,
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('5 MiB');
  await user.upload(input, [file(), file()]);
  expect(screen.getByRole('alert')).toHaveTextContent('at most 1');
});
it('uploads use multipart and memory bearer, never client uploader identity', async () => {
  const fetcher = vi.fn(async () => json({ data: media }, 201));
  vi.stubGlobal('fetch', fetcher);
  expect(await uploadImages('places', placeId, [selected()])).toBe(
    '1 of 1 images confirmed uploaded.',
  );
  const init = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(init[1].headers).toMatchObject({ Authorization: 'Bearer synthetic-token' });
  expect(init[1].headers).not.toHaveProperty('Content-Type');
  const body = init[1].body as FormData;
  expect([...body.keys()]).toEqual(['image', 'altText']);
});
it('Add Place orders create, media, report and review while preserving partial failures', async () => {
  const calls: string[] = [];
  let uploads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      calls.push(path);
      if (path.endsWith('/media'))
        return ++uploads === 1
          ? json({ data: media }, 201)
          : json({ error: { message: 'Image storage unavailable.' } }, 503);
      if (path.endsWith('/reviews')) return json({ error: { message: 'Review failed.' } }, 503);
      return json({ data: { id: placeId, name: 'Created' } }, 201);
    }),
  );
  const result = await addPlaceWithContributions(
    { name: 'Test', categoryId, city: 'Test', countryCode: 'IL' },
    [{ featureId: 'feature', type: 'boolean', value: true }],
    'Review',
    [selected(), selected()],
  );
  expect(calls.map((path) => path.split('/').at(-1))).toEqual([
    'places',
    'media',
    'media',
    'accessibility-reports',
    'reviews',
  ]);
  expect(result.messages.join(' ')).toContain('Place created successfully.');
  expect(result.messages.join(' ')).toContain('1 of 2 images confirmed uploaded.');
  expect(result.messages.join(' ')).toContain('Accessibility information saved.');
  expect(result.messages.join(' ')).toContain('Review was not confirmed published.');
});
it('Add Place form sends selected images after place creation', async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/categories'))
      return json({ data: [{ id: categoryId, displayName: 'Hotel' }] });
    if (url.endsWith('/features')) return json({ data: [] });
    if (url.endsWith('/media')) return json({ data: media }, 201);
    if (init?.method === 'POST') return json({ data: { id: placeId, name: 'Test place' } }, 201);
    return json({ data: [] });
  });
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  view(<AddPlacePage />);
  await user.type(screen.getByLabelText('Place name'), 'Test place');
  await user.selectOptions(
    screen.getByLabelText('Category'),
    (await screen.findByRole('option', { name: 'Hotel' })).getAttribute('value')!,
  );
  await user.type(screen.getByLabelText('City'), 'Test city');
  await user.type(screen.getByLabelText('Country (two-letter code)'), 'IL');
  await user.upload(screen.getByLabelText('Choose images'), file());
  await user.click(screen.getByRole('button', { name: 'Create place' }));
  expect(await screen.findByText('1 of 1 images confirmed uploaded.')).toBeInTheDocument();
});
for (const fail of [false, true])
  it(`review saves text first and reports ${fail ? 'partial image failure' : 'image success'}`, async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        paths.push(url);
        return url.endsWith('/media')
          ? fail
            ? json({ error: { message: 'Image unavailable' } }, 503)
            : json({ data: media }, 201)
          : json({ data: review }, 201);
      }),
    );
    const saved = vi.fn(),
      user = userEvent.setup();
    view(<ReviewComposer placeId={placeId} onSaved={saved} />);
    await user.type(screen.getByLabelText('Your review'), 'A useful review');
    await user.upload(screen.getByLabelText('Choose images'), file());
    await user.click(screen.getByRole('button', { name: 'Publish review' }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0]![0]).toContain(
      `Review published. ${fail ? 0 : 1} of 1 images confirmed uploaded.`,
    );
    expect(paths[0]).toContain('/reviews');
    expect(paths[1]).toContain('/reviews/review-id/media');
  });
it('uploaded gallery uses alt descriptions and graceful broken-image fallback', () => {
  view(<PlaceGallery media={[media]} placeName="Test place" />);
  const image = screen.getByAltText('Step-free doorway');
  expect(image).toHaveAttribute('src', media.storageReference);
  fireEvent.error(image);
  expect(
    screen.getByRole('img', { name: 'Step-free doorway — image unavailable' }),
  ).toBeInTheDocument();
});
it('review gallery renders uploaded media without exposing owner management to another user', () => {
  view(
    <ReviewList
      reviews={{
        data: [{ ...review, author: { id: 'other', displayName: 'Other' } }],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }}
      loading={false}
      error={null}
      onRetry={() => {}}
      onPrevious={() => {}}
      onNext={() => {}}
      onSaved={() => {}}
    />,
  );
  expect(screen.getByAltText('Step-free doorway')).toBeInTheDocument();
  expect(screen.queryByText('Your review images')).not.toBeInTheDocument();
});
it('owner removal requires keyboard-accessible confirmation and reports success', async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'DELETE' ? new Response(null, { status: 204 }) : json({ data: [media] }),
  );
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn(),
    user = userEvent.setup();
  view(<MediaManager target="places" id={placeId} onSaved={saved} />);
  const remove = await screen.findByRole('button', { name: 'Remove image 1' });
  remove.focus();
  await user.keyboard('{Enter}');
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  const confirm = screen.getByRole('button', { name: 'Confirm remove image 1' });
  confirm.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(saved).toHaveBeenCalledWith('Image removed.'));
});
it('owner control denial is hidden without affecting the public page', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({ error: { message: 'Forbidden' } }, 403)),
  );
  view(<MediaManager target="places" id={placeId} onSaved={() => {}} />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.queryByText('Your place images')).not.toBeInTheDocument();
});
