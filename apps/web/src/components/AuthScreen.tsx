import { useState, type FormEvent } from 'react';
import { ArrowRight, Blocks, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') await auth.register({ name, email, password });
      else await auth.login({ email, password });
      const destination = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-[#f7f8f6] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-stone-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.28),transparent_38%),radial-gradient(circle_at_80%_75%,rgba(255,255,255,0.09),transparent_35%)]" />
        <div className="relative flex items-center gap-3 text-sm font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-400 text-stone-950">
            <Blocks className="size-5" />
          </span>
          Collabspace
        </div>
        <div className="relative max-w-xl pb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Think together
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">
            One calm place for pages, plans, and progress.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-stone-300">
            Organize work into connected pages and give every collaborator exactly the access they
            need.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-stone-900 text-white">
              <Blocks className="size-5" />
            </span>
            <span className="font-semibold">Collabspace</span>
          </div>
          <p className="text-sm font-semibold text-emerald-700">
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-stone-900">
            {mode === 'register' ? 'Start a new workspace' : 'Sign in to your workspace'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            {mode === 'register'
              ? 'Use at least 12 characters for your password.'
              : 'Enter the email and password for your account.'}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <label className="auth-field">
                <span>Name</span>
                <div>
                  <UserRound className="size-4" />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </div>
              </label>
            ) : null}
            <label className="auth-field">
              <span>Email</span>
              <div>
                <Mail className="size-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div>
                <LockKeyhole className="size-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 12 : 1}
                  maxLength={128}
                  required
                />
              </div>
            </label>

            {error ? (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
              {!submitting ? <ArrowRight className="size-4" /> : null}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            {mode === 'register' ? 'Already have an account?' : 'New to Collabspace?'}{' '}
            <Link
              className="font-semibold text-stone-900 hover:text-emerald-700"
              to={mode === 'register' ? '/login' : '/register'}
            >
              {mode === 'register' ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
