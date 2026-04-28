'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchCloudSetlistById, getChartAudioPublicUrl, type SavedChart, type Setlist } from '../../../lib/cloudSync';

const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-zinc-700 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 print:hidden';

function chartTitle(chart?: SavedChart) {
  return chart?.title?.trim() || 'Missing song';
}

export default function SharedSetlistPage() {
  const params = useParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [message, setMessage] = useState('Loading shared setlist...');
  const chartMap = useMemo(() => new Map(charts.map((chart) => [chart.id, chart])), [charts]);

  useEffect(() => {
    let isActive = true;

    async function loadSetlist() {
      const result = await fetchCloudSetlistById(params.id);

      if (!isActive) {
        return;
      }

      if (result.error || !result.setlist) {
        setMessage(result.error || 'Shared setlist was not found.');
        setSetlist(null);
        setCharts([]);
        return;
      }

      setSetlist(result.setlist);
      setCharts(result.charts);
      setMessage('');
    }

    void loadSetlist();

    return () => {
      isActive = false;
    };
  }, [params.id]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 print:max-w-none print:gap-4">
        <header className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Shared Setlist</p>
            <h1 className="text-3xl font-semibold text-white">{setlist?.name || 'Shared Setlist'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => window.print()}>
              Print
            </button>
            <Link href="/" className={SECONDARY_BUTTON_CLASS}>
              Open App
            </Link>
          </div>
        </header>

        {message ? (
          <section className="rounded-3xl border border-zinc-800 bg-black/70 p-6 text-sm text-zinc-300 print:border-0 print:bg-white print:text-black">
            {message}
          </section>
        ) : null}

        {setlist ? (
          <section className="rounded-3xl border border-zinc-800 bg-black/70 p-6 shadow-xl shadow-black/20 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
            <h2 className="text-2xl font-semibold text-white print:text-black">{setlist.name}</h2>
            <ol className="mt-5 space-y-3 print:list-decimal print:space-y-2 print:pl-6">
              {setlist.songIds.length ? (
                setlist.songIds.map((songId, index) => {
                  const chart = chartMap.get(songId);
                  const audioUrl = chart ? getChartAudioPublicUrl(chart) : '';

                  return (
                    <li key={`${songId}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 print:rounded-none print:border-0 print:bg-white print:p-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 print:inline">
                            <h3 className="text-lg font-semibold text-white print:inline print:text-base print:text-black">{chartTitle(chart)}</h3>
                            {audioUrl ? (
                              <span className="no-print rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                                MP3
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-zinc-300 print:inline print:text-black">
                            {chart ? (chart.key ? `Key: ${chart.key}` : 'Key: N/A') : 'Missing song'}
                          </p>
                        </div>
                        {chart ? (
                          <div className="flex flex-wrap gap-2 print:hidden">
                            <Link href={`/share/chart/${chart.id}`} className={SECONDARY_BUTTON_CLASS}>
                              Open Chart
                            </Link>
                            {audioUrl ? (
                              <a href={audioUrl} download={chart.audioFilename || undefined} target="_blank" rel="noreferrer" className={SECONDARY_BUTTON_CLASS}>
                                Download MP3
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="text-sm text-zinc-400 print:text-black">No songs in this setlist.</li>
              )}
            </ol>
          </section>
        ) : null}
      </div>
    </main>
  );
}
