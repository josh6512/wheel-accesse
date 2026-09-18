import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlaceCard } from '../components/places/PlaceCard';
import { PlaceCardSkeleton } from '../components/places/PlaceCardSkeleton';
import { AccessibilityFilters } from '../components/search/AccessibilityFilters';
import { MobileFilters } from '../components/search/MobileFilters';
import { Pagination } from '../components/search/Pagination';
import { SearchForm } from '../components/search/SearchForm';
import { useCategories, useCategoryFeatures, usePlaceSearch } from '../hooks';
import { parseSearchUrl, toSearchUrl } from '../search/searchUrlState';

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchState = useMemo(() => parseSearchUrl(location.search), [location.search]);
  const categories = useCategories();
  const features = useCategoryFeatures(searchState.category);
  const places = usePlaceSearch(searchState);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef(searchState.page);
  const booleanFeatures = useMemo(
    () => features.data.filter((feature) => feature.valueType === 'boolean'),
    [features.data],
  );
  const categoryName =
    categories.data.find((category) => category.id === searchState.category)?.displayName ??
    'Selected category';

  useEffect(() => {
    if (!places.loading && previousPage.current !== searchState.page) {
      resultHeadingRef.current?.focus();
      previousPage.current = searchState.page;
    }
  }, [places.loading, searchState.page]);

  function toggleFeature(featureId: string, selected: boolean) {
    const featureIds = selected
      ? [...searchState.featureIds, featureId]
      : searchState.featureIds.filter((id) => id !== featureId);
    navigate(toSearchUrl({ ...searchState, featureIds: [...new Set(featureIds)], page: 1 }));
  }

  const filterPanel = (
    <AccessibilityFilters
      features={booleanFeatures}
      selectedIds={searchState.featureIds}
      loading={features.loading}
      error={features.error}
      onToggle={toggleFeature}
      onRetry={features.retry}
    />
  );

  return (
    <div className="search-page">
      <section className="edit-search" aria-labelledby="edit-search-title">
        <div className="edit-search-heading">
          <div>
            <p className="section-kicker">Your search</p>
            <h1 id="edit-search-title">
              {searchState.city || 'All cities'} <span>·</span> {categoryName}
            </h1>
          </div>
          <p>{searchState.country || 'Any country'}</p>
        </div>
        <SearchForm
          key={`${searchState.city}-${searchState.country}-${searchState.category}-${searchState.q}`}
          compact
          submitLabel="Update search"
          categories={categories.data}
          categoriesLoading={categories.loading}
          categoriesError={categories.error}
          initialValues={searchState}
          onSubmit={(values) =>
            navigate(
              toSearchUrl({
                ...values,
                featureIds: [],
                page: 1,
                pageSize: searchState.pageSize,
              }),
            )
          }
        />
      </section>

      <div className="results-toolbar">
        <div>
          <p className="section-kicker">Search results</p>
          <h2 ref={resultHeadingRef} tabIndex={-1}>
            {places.loading
              ? 'Finding places…'
              : `${places.data?.pagination.totalItems ?? 0} matching ${
                  places.data?.pagination.totalItems === 1 ? 'place' : 'places'
                }`}
          </h2>
        </div>
        {searchState.category ? (
          <MobileFilters
            open={mobileFiltersOpen}
            selectedCount={searchState.featureIds.length}
            onOpen={() => setMobileFiltersOpen(true)}
            onClose={() => setMobileFiltersOpen(false)}
          >
            {filterPanel}
          </MobileFilters>
        ) : null}
      </div>

      <div className="search-layout">
        <aside className="filters-sidebar" aria-label="Search filters">
          <section className="filter-context">
            <p className="section-kicker">Search context</p>
            <dl>
              <div>
                <dt>Destination</dt>
                <dd>{searchState.city || 'All cities'}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{categoryName}</dd>
              </div>
            </dl>
          </section>
          {searchState.category ? filterPanel : null}
          {searchState.featureIds.length > 0 ? (
            <button
              className="text-button clear-filters"
              type="button"
              onClick={() => navigate(toSearchUrl({ ...searchState, featureIds: [], page: 1 }))}
            >
              Clear accessibility filters
            </button>
          ) : null}
        </aside>

        <section className="results-list" aria-label="Places" aria-busy={places.loading}>
          <div className="sr-only" role="status" aria-live="polite">
            {places.loading
              ? 'Loading search results.'
              : places.error
                ? 'Search results could not be loaded.'
                : `${places.data?.pagination.totalItems ?? 0} places loaded.`}
          </div>
          {places.loading ? (
            Array.from({ length: 3 }, (_, index) => <PlaceCardSkeleton key={index} />)
          ) : places.error ? (
            <div className="state-card state-card--error" role="alert">
              <span className="state-icon" aria-hidden="true">
                !
              </span>
              <h2>We couldn’t load these places</h2>
              <p>{places.error}</p>
              <button className="button button--secondary" type="button" onClick={places.retry}>
                Try search again
              </button>
            </div>
          ) : places.data?.data.length === 0 ? (
            <div className="state-card">
              <span className="state-icon" aria-hidden="true">
                ⌕
              </span>
              <h2>No matching places found</h2>
              <p>Try a broader place name or remove one or more accessibility filters.</p>
              {searchState.featureIds.length > 0 ? (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => navigate(toSearchUrl({ ...searchState, featureIds: [], page: 1 }))}
                >
                  Remove accessibility filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {places.data?.data.map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))}
              {places.data ? (
                <Pagination pagination={places.data.pagination} searchState={searchState} />
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
