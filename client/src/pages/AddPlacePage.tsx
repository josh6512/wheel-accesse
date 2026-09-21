import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useCategories, useCategoryFeatures } from '../hooks/useApiResources';
import { AccessibilityFields } from '../components/community/AccessibilityFields';
import { reportAnswers } from '../services/reportAnswers';
import { addPlaceWithContributions, writeError } from '../services/communityService';
import { ApiError } from '../services/apiClient';
import type { DuplicatePlace, NewPlace } from '../types/api';

export function AddPlacePage() {
  const { user, restoring } = useAuth();
  if (restoring) return <p role="status">Checking session…</p>;
  if (!user) return <Navigate to="/login?returnTo=%2Fplaces%2Fnew" replace />;
  return <AddPlaceForm />;
}
function AddPlaceForm() {
  const categories = useCategories();
  const [categoryId, setCategoryId] = useState('');
  const features = useCategoryFeatures(categoryId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<DuplicatePlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof addPlaceWithContributions>
  > | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    if (!text('name') || !text('city')) {
      setError('Place name and city cannot be blank.');
      return;
    }
    if (Boolean(text('latitude')) !== Boolean(text('longitude'))) {
      setError('Supply both latitude and longitude, or leave both blank.');
      return;
    }
    const input: NewPlace = {
      name: text('name'),
      city: text('city'),
      countryCode: text('countryCode').toUpperCase(),
      categoryId,
      ...(text('address') ? { address: text('address') } : {}),
      ...(text('region') ? { region: text('region') } : {}),
      ...(text('latitude')
        ? { latitude: Number(text('latitude')), longitude: Number(text('longitude')) }
        : {}),
    };
    setBusy(true);
    setError('');
    setMatches([]);
    try {
      setResult(
        await addPlaceWithContributions(
          input,
          reportAnswers(features.data, values),
          text('review'),
        ),
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'POSSIBLE_DUPLICATE_PLACE')
        setMatches(reason.matches ?? []);
      setError(writeError(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="write-page" aria-labelledby="add-place-title">
      <p className="section-kicker">Contribute to the community</p>
      <h1 id="add-place-title">Add a place</h1>
      {result ? (
        <div className="state-card">
          <div role="status">
            {result.messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
          <Link className="button button--primary" to={`/places/${result.place.id}`}>
            View {result.place.name}
          </Link>
          <p>
            You can check saved contributions and retry any missing information on the place page.
          </p>
        </div>
      ) : (
        <form className="write-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
          <fieldset disabled={busy}>
            <legend>Place details</legend>
            <label>
              Place name
              <input name="name" maxLength={200} pattern=".*\S.*" required />
            </label>
            <label>
              Category
              <select
                required
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setValues({});
                }}
                disabled={categories.loading}
              >
                <option value="">Choose a category</option>
                {categories.data.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.displayName}
                  </option>
                ))}
              </select>
            </label>
            {categories.error && (
              <p role="alert">
                Categories could not be loaded.{' '}
                <button type="button" onClick={categories.retry}>
                  Retry categories
                </button>
              </p>
            )}
            <div className="write-grid">
              <label>
                City
                <input name="city" maxLength={120} pattern=".*\S.*" required />
              </label>
              <label>
                Country (two-letter code)
                <input
                  name="countryCode"
                  minLength={2}
                  maxLength={2}
                  pattern="[A-Za-z]{2}"
                  placeholder="e.g. IL"
                  required
                />
              </label>
            </div>
            <label>
              Address (optional)
              <input name="address" maxLength={500} />
            </label>
            <label>
              Region (optional)
              <input name="region" maxLength={120} />
            </label>
            <div className="write-grid">
              <label>
                Latitude (optional)
                <input name="latitude" type="number" min={-90} max={90} step="any" />
              </label>
              <label>
                Longitude (optional)
                <input name="longitude" type="number" min={-180} max={180} step="any" />
              </label>
            </div>
            {features.loading && <p role="status">Loading accessibility questions…</p>}
            {features.error ? (
              <p role="alert">
                Accessibility questions could not be loaded.{' '}
                <button type="button" onClick={features.retry}>
                  Retry questions
                </button>
              </p>
            ) : (
              categoryId && (
                <AccessibilityFields
                  features={features.data}
                  values={values}
                  onChange={(id, value) => setValues((previous) => ({ ...previous, [id]: value }))}
                />
              )
            )}
            <label>
              Share your experience (optional)
              <textarea name="review" maxLength={4000} rows={3} />
            </label>
            <p>
              Reviews are plain-text community comments. Please do not include personal or sensitive
              information.
            </p>
          </fieldset>
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          {matches.length > 0 && (
            <section aria-label="Possible existing places">
              <ul>
                {matches.map((match) => (
                  <li key={match.id}>
                    <Link to={`/places/${match.id}`}>{match.name}</Link> —{' '}
                    {[match.address, match.city, match.countryCode].filter(Boolean).join(', ')}
                  </li>
                ))}
              </ul>
              <p>Open an existing place or cancel. There is no duplicate override.</p>
            </section>
          )}
          <div className="write-actions">
            <button
              className="button button--primary"
              disabled={
                busy ||
                categories.loading ||
                features.loading ||
                Boolean(categories.error || features.error)
              }
            >
              {busy ? 'Saving contributions…' : 'Create place'}
            </button>
            <Link className="button" to="/search">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
