import type { PropsWithChildren } from 'react';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Wheel Accesses home">
          <span className="brand-mark" aria-hidden="true">
            WA
          </span>
          <span>Wheel Accesses</span>
        </a>
      </header>
      <main>{children}</main>
    </div>
  );
}
