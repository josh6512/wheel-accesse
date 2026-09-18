import { useNavigate } from 'react-router-dom';
import { SearchForm } from '../components/search/SearchForm';
import { useCategories } from '../hooks';
import { toSearchUrl } from '../search/searchUrlState';

export function HomePage() {
  const navigate = useNavigate();
  const categories = useCategories();

  return (
    <div className="home-page">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">Places that work for you</p>
          <h1 id="page-title">Find places with accessibility information you can use.</h1>
          <p className="intro">
            Explore community-reported accessibility details before you go—clearly, calmly, and on
            your own terms.
          </p>
        </div>
        <div className="hero-search">
          <div className="search-panel-heading">
            <span className="search-panel-icon" aria-hidden="true">
              ⌖
            </span>
            <div>
              <p className="section-kicker">Start exploring</p>
              <h2>Where would you like to go?</h2>
            </div>
          </div>
          <SearchForm
            categories={categories.data}
            categoriesLoading={categories.loading}
            categoriesError={categories.error}
            onSubmit={(values) =>
              navigate(
                toSearchUrl({
                  ...values,
                  featureIds: [],
                  page: 1,
                  pageSize: 20,
                }),
              )
            }
          />
          {categories.error ? (
            <button className="text-button category-retry" type="button" onClick={categories.retry}>
              Retry category loading
            </button>
          ) : null}
          <p className="search-assurance">
            <span aria-hidden="true">●</span>
            No account needed. Accessibility details come from community reports.
          </p>
        </div>
      </section>
      <section className="home-principles" aria-label="What Wheel Accesses offers">
        <div>
          <span aria-hidden="true">01</span>
          <strong>Search simply</strong>
          <p>Choose a city and category to find relevant places.</p>
        </div>
        <div>
          <span aria-hidden="true">02</span>
          <strong>Filter for your needs</strong>
          <p>Use accessibility features configured for each category.</p>
        </div>
        <div>
          <span aria-hidden="true">03</span>
          <strong>See the evidence</strong>
          <p>Understand where community reports agree or differ.</p>
        </div>
      </section>
    </div>
  );
}
