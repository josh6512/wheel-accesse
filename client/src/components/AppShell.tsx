import { useState, type PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function AppShell({ children }: PropsWithChildren) {
  const { user, restoring, logout } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch {
      setError('Sign out failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
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
          <Link className="button" to="/places/new">
            Add place
          </Link>
          {restoring ? (
            <span role="status">Checking session…</span>
          ) : user ? (
            <div className="account-actions">
              <Link to="/account" className="account-name" aria-label="Your account">
                {user.displayName ?? 'Your account'}
              </Link>
              <button className="button" disabled={busy} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <Link className="button" to="/login">
              Sign in
            </Link>
          )}
          {error && <p role="alert">{error}</p>}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
