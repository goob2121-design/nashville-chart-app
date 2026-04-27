'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';

const AUTH_STORAGE_KEY = 'pinnacle-chart-auth';
const LOGO_SRC = '/pinnacle-logo.png';

export function BrandHeaderTitle({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={LOGO_SRC}
        alt="Pinnacle Recording Studio"
        className="h-auto w-12 shrink-0 sm:w-16"
      />
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-white sm:text-4xl">Pinnacle Recording Studio Chart System</h1>
        <p className="mt-1 text-xs font-medium text-stone-400 sm:text-sm">{subtitle ?? 'Utilizing the Nashville Number System'}</p>
      </div>
    </div>
  );
}

export function AuthGate({
  children,
  bypass = false,
}: {
  children: ReactNode;
  bypass?: boolean;
}) {
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const configuredPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (bypass || !configuredPassword) {
      setIsAuthenticated(true);
      setHasCheckedAuth(true);
      return;
    }

    setIsAuthenticated(window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true');
    setHasCheckedAuth(true);
  }, [bypass, configuredPassword]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configuredPassword || password === configuredPassword) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      setError('');
      return;
    }

    setError('That password did not work. Please try again.');
  }

  function handleLogout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setPassword('');
  }

  if (!hasCheckedAuth) {
    return (
      <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100">
        <div className="mx-auto max-w-md rounded-3xl border border-amber-950/30 bg-stone-900/75 p-5 text-sm text-stone-400">
          Loading...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-10 text-stone-100">
        <form onSubmit={handleLogin} className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-amber-950/30 bg-stone-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col items-center gap-4 text-center">
            <img src={LOGO_SRC} alt="Pinnacle Recording Studio" className="h-auto w-24" />
            <div>
              <h1 className="text-2xl font-semibold text-white">Pinnacle Recording Studio Chart System</h1>
              <p className="mt-2 text-sm text-stone-400">Utilizing the Nashville Number System</p>
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
            Password
            <input
              type="password"
              className="w-full rounded-xl border border-amber-950/40 bg-stone-950/70 px-3 py-2.5 text-base text-stone-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="text-sm text-amber-200">{error}</p> : null}
          {isDevelopment && !configuredPassword ? (
            <p className="text-xs leading-5 text-amber-200">Development warning: NEXT_PUBLIC_ADMIN_PASSWORD is not set, so the app is unlocked.</p>
          ) : null}

          <button type="submit" className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300">
            Enter
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="no-print fixed right-3 top-3 z-40">
        <button
          type="button"
          className="rounded-xl border border-amber-900/40 bg-stone-950/80 px-3 py-2 text-xs font-medium text-stone-100 shadow-lg shadow-black/20 transition hover:bg-stone-900"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
      {isDevelopment && !configuredPassword ? (
        <div className="no-print fixed bottom-3 left-3 z-40 max-w-xs rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          NEXT_PUBLIC_ADMIN_PASSWORD is not set. Running unlocked in development.
        </div>
      ) : null}
      {children}
    </>
  );
}
