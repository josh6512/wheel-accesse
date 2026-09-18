import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Wheel Accesses home">
          <span className="brand-mark" aria-hidden="true">
            <span>W</span>
          </span>
          <span>Wheel Accesses</span>
        </Link>
        <nav aria-label="Account">
          <button
            className="account-placeholder"
            type="button"
            disabled
            aria-label="Sign in, coming in a future release"
            title="Account access is coming soon"
          >
            <span className="account-icon" aria-hidden="true">
              ○
            </span>
            <span>Sign in</span>
            <span className="soon-label">Soon</span>
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
