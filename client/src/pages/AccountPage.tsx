import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { currentUser, type AuthUser } from '../auth/authSession';
import { useAuth } from '../auth/useAuth';

export function AccountPage() {
  const { user, restoring } = useAuth();
  const [account, setAccount] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void currentUser()
      .then((user) => {
        if (!cancelled) setAccount(user);
      })
      .catch(() => {
        if (!cancelled) setError('Please sign in to view your account.');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="auth-page">
      <h1>Your account</h1>
      {error || (!restoring && !user) ? (
        <p role="alert">
          {error || 'Please sign in to view your account.'} <Link to="/login">Sign in</Link>
        </p>
      ) : account && user?.id === account.id ? (
        <>
          <p>Display name: {account.displayName}</p>
          <p>Private email: {account.email}</p>
        </>
      ) : (
        <p role="status">Loading your account…</p>
      )}
      <Link to="/search">Explore places</Link>
    </section>
  );
}
