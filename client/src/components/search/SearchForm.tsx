import { useState, type FormEvent } from 'react';
import type { Category } from '../../types/api';

export interface SearchFormValues {
  city: string;
  country: string;
  category: string;
  q: string;
}

interface SearchFormProps {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError?: string | null;
  initialValues?: Partial<SearchFormValues>;
  compact?: boolean;
  submitLabel?: string;
  onSubmit: (values: SearchFormValues) => void;
}

export function SearchForm({
  categories,
  categoriesLoading,
  categoriesError,
  initialValues,
  compact = false,
  submitLabel = 'Search places',
  onSubmit,
}: SearchFormProps) {
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [country, setCountry] = useState(initialValues?.country ?? '');
  const [category, setCategory] = useState(initialValues?.category ?? '');
  const [q, setQ] = useState(initialValues?.q ?? '');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      city: city.trim(),
      country: country.trim().toUpperCase(),
      category,
      q: q.trim(),
    });
  }

  return (
    <form
      className={`search-form${compact ? ' search-form--compact' : ''}`}
      onSubmit={handleSubmit}
    >
      <div className="search-field search-field--city">
        <label htmlFor={compact ? 'edit-city' : 'home-city'}>City</label>
        <input
          id={compact ? 'edit-city' : 'home-city'}
          name="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="e.g. Tel Aviv"
          maxLength={120}
          required
        />
      </div>
      <div className="search-field search-field--country">
        <label htmlFor={compact ? 'edit-country' : 'home-country'}>Country (optional)</label>
        <input
          id={compact ? 'edit-country' : 'home-country'}
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="IL"
          pattern="[A-Za-z]{2}"
          maxLength={2}
          aria-describedby={compact ? 'edit-country-hint' : 'home-country-hint'}
        />
        <span className="sr-only" id={compact ? 'edit-country-hint' : 'home-country-hint'}>
          Enter a two-letter country code.
        </span>
      </div>
      <div className="search-field search-field--category">
        <label htmlFor={compact ? 'edit-category' : 'home-category'}>Category</label>
        <select
          id={compact ? 'edit-category' : 'home-category'}
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={categoriesLoading || Boolean(categoriesError)}
          required
        >
          <option value="">
            {categoriesLoading ? 'Loading categories…' : 'Choose a category'}
          </option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="search-field search-field--query">
        <label htmlFor={compact ? 'edit-query' : 'home-query'}>Place name (optional)</label>
        <input
          id={compact ? 'edit-query' : 'home-query'}
          name="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Hotel, café, museum…"
          maxLength={200}
        />
      </div>
      <button className="button button--primary search-submit" type="submit">
        <span aria-hidden="true">⌕</span>
        {submitLabel}
      </button>
      {categoriesError ? (
        <p className="field-error" role="alert">
          Categories are unavailable. Please try again shortly.
        </p>
      ) : null}
    </form>
  );
}
