'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { getChartAudioPublicUrl } from '../lib/cloudSync';
import {
  createSectionSeparator,
  getPrintableChartText,
  isReferenceTag,
  serializePrintableChart,
  type PrintableChartData,
} from '../lib/chartPrint';

export const PRINT_ACTION_BUTTON_CLASS =
  'rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 transition hover:bg-stone-100';

function PrintChartLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim();
        const isSection = /^\[.+\]$/.test(trimmed);
        const isReference = isReferenceTag(trimmed);
        const displayLine = isSection ? createSectionSeparator(trimmed) : line;

        return (
          <div
            key={`${line}-${index}`}
            className={`print-line ${isSection ? 'print-section' : ''} ${isReference ? 'print-reference' : ''}`.trim()}
          >
            {displayLine || '\u00A0'}
          </div>
        );
      })}
    </>
  );
}

export function buildPrintChartHref(chart: PrintableChartData): string {
  return `/print/chart?chart=${serializePrintableChart(chart)}`;
}

export default function PrintableChartView({
  chart,
  extraActions,
  heading = 'Print / PDF Preview',
  homeHref,
  homeLabel,
}: {
  chart: PrintableChartData;
  extraActions?: ReactNode;
  heading?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  const chartText = getPrintableChartText(chart);
  const downloadAudioUrl = getChartAudioPublicUrl(chart);

  function handleBackOrClose() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.close();

    window.setTimeout(() => {
      window.location.href = homeHref || '/';
    }, 150);
  }

  return (
    <main className="min-h-screen bg-stone-200 px-3 py-4 text-stone-900 sm:px-6 sm:py-8 print:bg-white print:p-0">
      <style jsx global>{`
        .print-only {
          display: none;
        }

        .print-sheet {
          width: 100%;
          max-width: 8.5in;
          margin: 0 auto;
          background: #fff;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .print-logo {
          width: 72px;
          height: auto;
          object-fit: contain;
          opacity: 0.95;
        }

        .print-chart-text {
          white-space: pre-wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 16pt;
          line-height: 1.45;
        }

        .print-line {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .print-section {
          margin-top: 0.45rem;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .print-section + .print-line {
          break-before: avoid;
          page-break-before: avoid;
        }

        .print-reference {
          font-style: italic;
        }

        @page {
          size: letter;
          margin: 0.5in;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          html,
          body {
            background: #fff !important;
            color: #000 !important;
          }

          .print-sheet {
            max-width: none;
            margin: 0;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="no-print flex flex-col gap-3 rounded-3xl border border-stone-300 bg-white px-4 py-4 shadow-lg shadow-stone-900/5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{heading}</p>
            <h1 className="mt-1 text-2xl font-semibold text-stone-950">{chart.title?.trim() || 'Untitled Song'}</h1>
            {chart.artist?.trim() ? <p className="mt-1 text-sm text-stone-600">{chart.artist}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {extraActions}
            {downloadAudioUrl ? (
              <a
                href={downloadAudioUrl}
                download={chart.audioFilename || undefined}
                target="_blank"
                rel="noreferrer"
                className={PRINT_ACTION_BUTTON_CLASS}
              >
                Download MP3
              </a>
            ) : null}
            <button type="button" className={PRINT_ACTION_BUTTON_CLASS} onClick={() => window.print()}>
              Print / PDF
            </button>
            <button type="button" className={PRINT_ACTION_BUTTON_CLASS} onClick={handleBackOrClose}>
              Back / Close
            </button>
            {homeHref ? (
              <Link href={homeHref} className={PRINT_ACTION_BUTTON_CLASS}>
                {homeLabel || 'Open App'}
              </Link>
            ) : null}
          </div>
        </header>

        <article className="print-sheet rounded-[28px] border border-stone-300 bg-white p-5 shadow-xl shadow-stone-900/10 sm:p-8 print:p-0">
          <header className="print-header border-b border-stone-300 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-3xl font-semibold leading-tight text-black">{chart.title?.trim() || 'Untitled Song'}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5 text-black">
                {chart.artist?.trim() ? <p><span className="font-semibold">Artist:</span> {chart.artist}</p> : null}
                {chart.key?.trim() ? <p><span className="font-semibold">Key:</span> {chart.key}</p> : null}
                {chart.tempo?.trim() ? <p><span className="font-semibold">BPM:</span> {chart.tempo}</p> : null}
                {chart.feel?.trim() ? <p><span className="font-semibold">Feel:</span> {chart.feel}</p> : null}
                {chart.timeSignature?.trim() ? <p><span className="font-semibold">Time:</span> {chart.timeSignature}</p> : null}
                {chart.capo?.trim() ? <p><span className="font-semibold">Capo:</span> {chart.capo}</p> : null}
              </div>
              {chart.notes?.trim() ? (
                <div className="mt-3 text-sm leading-6 text-black">
                  <span className="font-semibold">Notes:</span>{' '}
                  <span className="whitespace-pre-wrap">{chart.notes}</span>
                </div>
              ) : null}
            </div>
            <img
              src="/pinnacle-logo.png"
              alt="Pinnacle ChartBuilder"
              className="print-logo shrink-0"
            />
          </header>

          <section className="mt-4 print:mt-3">
            <div className="print-chart-text text-black">
              <PrintChartLines text={chartText} />
            </div>
          </section>

          <footer className="mt-6 text-xs text-stone-500 print:mt-4 print:text-black">
            Created with Pinnacle ChartBuilder
          </footer>
        </article>
      </div>
    </main>
  );
}
