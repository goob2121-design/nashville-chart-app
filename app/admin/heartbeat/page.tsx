'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthGate, BrandHeaderTitle } from '../../components/AuthGate';
import type { AppHeartbeat } from '../../lib/cloudSync';

const PANEL_CLASS =
  'rounded-3xl border border-amber-950/30 bg-stone-900/75 p-5 shadow-xl shadow-black/10 backdrop-blur';
const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-amber-900/40 bg-stone-950/40 px-3.5 py-2.5 text-sm font-medium text-stone-100 transition hover:bg-stone-900/80 disabled:opacity-50';
const EMPHASIS_BUTTON_CLASS =
  'rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-emerald-300';

export default function HeartbeatAdminPage() {
  const [heartbeat, setHeartbeat] = useState<AppHeartbeat | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);

  async function loadHeartbeat() {
    setIsLoading(true);
    const response = await fetch('/api/heartbeat/manual', {
      method: 'GET',
      cache: 'no-store',
    });
    const result = (await response.json()) as { error?: string; heartbeat?: AppHeartbeat | null; status?: string };

    if (!response.ok) {
      setMessage(result.error || 'Could not load heartbeat status.');
      setStatus(result.status || 'Unavailable');
      setHeartbeat(null);
      setIsLoading(false);
      return;
    }

    setHeartbeat(result.heartbeat ?? null);
    setStatus(result.status || 'No heartbeat yet');
    setMessage('');
    setIsLoading(false);
  }

  async function handlePing() {
    setIsPinging(true);
    const response = await fetch('/api/heartbeat/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appName: 'chart-app' }),
    });
    const result = (await response.json()) as { error?: string; heartbeat?: AppHeartbeat | null; status?: string };

    if (!response.ok) {
      setMessage(result.error || 'Supabase heartbeat failed.');
      setStatus(result.status || status);
      setIsPinging(false);
      return;
    }

    setHeartbeat(result.heartbeat ?? null);
    setStatus(result.status || 'Healthy');
    setMessage('Supabase ping successful - last activity updated.');
    setIsPinging(false);
  }

  useEffect(() => {
    void loadHeartbeat();
  }, []);

  const heartbeatSourceLabel =
    heartbeat?.lastSource === 'manual' ? 'Manual' : heartbeat?.lastSource === 'cron' ? 'Cron' : 'Unknown';

  return (
    <AuthGate>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-8 text-stone-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <header className={`${PANEL_CLASS} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
            <BrandHeaderTitle subtitle="Supabase Heartbeat Admin" />
            <div className="flex flex-wrap gap-2">
              <Link href="/" className={SECONDARY_BUTTON_CLASS}>
                Back to Charts
              </Link>
              <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={() => void handlePing()} disabled={isPinging}>
                {isPinging ? 'Pinging...' : 'Ping Supabase'}
              </button>
            </div>
          </header>

          <section className={PANEL_CLASS}>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-amber-950/20 bg-stone-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Last Heartbeat</p>
                <p className="mt-2 text-sm text-stone-100">
                  {heartbeat?.lastPing ? new Date(heartbeat.lastPing).toLocaleString() : isLoading ? 'Loading...' : 'No heartbeat yet'}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-950/20 bg-stone-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Total Heartbeat Count</p>
                <p className="mt-2 text-sm text-stone-100">{heartbeat?.pingCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-amber-950/20 bg-stone-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Status</p>
                <p className="mt-2 text-sm text-stone-100">{status}</p>
              </div>
              <div className="rounded-2xl border border-amber-950/20 bg-stone-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Last Source</p>
                <p className="mt-2 text-sm text-stone-100">{heartbeatSourceLabel}</p>
              </div>
            </div>

            {message ? <p className="mt-4 text-sm text-stone-300">{message}</p> : null}
          </section>
        </div>
      </main>
    </AuthGate>
  );
}
