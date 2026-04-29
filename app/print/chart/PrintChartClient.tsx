'use client';

import { useSearchParams } from 'next/navigation';
import PrintableChartView from '../../components/PrintableChartView';
import { deserializePrintableChart } from '../../lib/chartPrint';

export default function PrintChartClient() {
  const searchParams = useSearchParams();
  const chartParam = searchParams.get('chart');
  const chart = chartParam ? deserializePrintableChart(chartParam) : null;

  if (!chart) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-300 bg-white p-6 shadow-lg shadow-stone-900/5">
          <p className="text-sm uppercase tracking-[0.28em] text-stone-500">Print / PDF</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-950">Chart not found</h1>
          <p className="mt-3 text-sm text-stone-600">
            Open Print / PDF from a chart to generate a print-friendly export view.
          </p>
        </div>
      </main>
    );
  }

  return <PrintableChartView chart={chart} heading="Print / PDF Preview" homeHref="/" homeLabel="Open App" />;
}

