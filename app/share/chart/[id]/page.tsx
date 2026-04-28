'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchCloudChartById, getChartAudioPublicUrl, type SavedChart } from '../../../lib/cloudSync';

const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-zinc-700 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 print:hidden';

function ChartLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, index) => (
        <div key={`${line}-${index}`}>{line || '\u00A0'}</div>
      ))}
    </>
  );
}

export default function SharedChartPage() {
  const params = useParams<{ id: string }>();
  const [chart, setChart] = useState<SavedChart | null>(null);
  const [message, setMessage] = useState('Loading shared chart...');

  useEffect(() => {
    let isActive = true;

    async function loadChart() {
      const result = await fetchCloudChartById(params.id);

      if (!isActive) {
        return;
      }

      if (result.error || !result.chart) {
        setMessage(result.error || 'Shared chart was not found.');
        setChart(null);
        return;
      }

      setChart(result.chart);
      setMessage('');
    }

    void loadChart();

    return () => {
      isActive = false;
    };
  }, [params.id]);

  const audioUrl = chart ? getChartAudioPublicUrl(chart) : '';
  const chartText = chart?.nashvilleChart?.trim() || chart?.chordChart?.trim() || 'No chart entered.';

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          .print-chart-text {
            white-space: pre-wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 16pt;
            line-height: 1.3;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 print:max-w-none print:gap-4">
        <header className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Shared Chart</p>
            <h1 className="text-3xl font-semibold text-white">{chart?.title || 'Shared Chart'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {audioUrl ? (
              <a href={audioUrl} download={chart?.audioFilename || undefined} target="_blank" rel="noreferrer" className={SECONDARY_BUTTON_CLASS}>
                Download MP3
              </a>
            ) : null}
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

        {chart ? (
          <section className="rounded-3xl border border-zinc-800 bg-black/70 p-6 shadow-xl shadow-black/20 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
            <div className="space-y-3 border-b border-zinc-800 pb-4 print:border-zinc-300">
              <h2 className="text-3xl font-semibold text-white print:text-black">{chart.title || 'Untitled Song'}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-300 print:text-black">
                {chart.artist?.trim() ? <p><span className="font-semibold">Artist:</span> {chart.artist}</p> : null}
                <p><span className="font-semibold">Key:</span> {chart.key || 'N/A'}</p>
                {chart.timeSignature?.trim() ? <p><span className="font-semibold">Time:</span> {chart.timeSignature}</p> : null}
                {chart.tempo?.trim() ? <p><span className="font-semibold">Tempo:</span> {chart.tempo}</p> : null}
                {chart.capo?.trim() ? <p><span className="font-semibold">Capo:</span> {chart.capo}</p> : null}
              </div>
            </div>

            {chart.notes?.trim() ? (
              <section className="mt-5 space-y-2 print:mt-2">
                <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400 print:text-black">Notes</h3>
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200 print:leading-5 print:text-black">{chart.notes}</p>
              </section>
            ) : null}

            <section className="mt-5 space-y-2 print:mt-2">
              <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400 print:hidden">Nashville Chart</h3>
              <div className="print-chart-text overflow-x-auto whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-4 font-mono text-lg leading-8 text-emerald-300 print:border-0 print:bg-white print:px-0 print:py-0 print:text-black">
                <ChartLines text={chartText} />
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}
