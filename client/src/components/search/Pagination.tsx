import { Link } from 'react-router-dom';
import { toSearchUrl, type SearchUrlState } from '../../search/searchUrlState';
import type { Pagination as PaginationData } from '../../types/api';

interface PaginationProps {
  pagination: PaginationData;
  searchState: SearchUrlState;
}

export function Pagination({ pagination, searchState }: PaginationProps) {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Search result pages">
      {pagination.hasPreviousPage ? (
        <Link
          className="page-link"
          to={toSearchUrl({ ...searchState, page: pagination.page - 1 })}
          aria-label={`Go to page ${pagination.page - 1}`}
        >
          ← Previous
        </Link>
      ) : (
        <span className="page-link page-link--disabled">← Previous</span>
      )}
      <span aria-current="page">
        Page <strong>{pagination.page}</strong> of {pagination.totalPages}
      </span>
      {pagination.hasNextPage ? (
        <Link
          className="page-link"
          to={toSearchUrl({ ...searchState, page: pagination.page + 1 })}
          aria-label={`Go to page ${pagination.page + 1}`}
        >
          Next →
        </Link>
      ) : (
        <span className="page-link page-link--disabled">Next →</span>
      )}
    </nav>
  );
}
