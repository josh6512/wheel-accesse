import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, restoring, authenticate } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await authenticate(mode, {
        email: String(data.get('email')),
        password: String(data.get('password')),
        ...(register ? { displayName: String(data.get('displayName')) } : {}),
      });
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <p className="section-kicker">Wheel Accesses community</p>
      <h1 id="auth-title">{register ? 'Create your account' : 'Welcome back'}</h1>
      <p>
        {register
          ? 'Choose a public display name. Your email stays private.'
          : 'Sign in to your Wheel Accesses account.'}
      </p>
      <form onSubmit={(event) => void submit(event)} aria-busy={busy || restoring}>
        {register && (
          <label>
            Display name
            <input
              name="displayName"
              autoComplete="nickname"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 15 : 1}
            maxLength={128}
            aria-describedby={register ? 'password-help' : undefined}
            required
          />
        </label>
        {register && (
          <p id="password-help">Use 15–128 characters. A long, memorable passphrase works well.</p>
        )}
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        <button className="button button--primary" disabled={busy || restoring}>
          {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p>
        {register ? 'Already have an account? ' : 'New to Wheel Accesses? '}
        <Link to={register ? '/login' : '/register'}>
          {register ? 'Sign in' : 'Create account'}
        </Link>
      </p>
    </section>
  );
}
