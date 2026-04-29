import { Suspense } from 'react';
import PrintChartClient from './PrintChartClient';

function PrintChartFallback() {
  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900">
      <div className="mx-auto max-w-2xl rounded-3xl border border-stone-300 bg-white p-6 shadow-lg shadow-stone-900/5">
        <p className="text-sm uppercase tracking-[0.28em] text-stone-500">Print / PDF</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">Loading chart...</h1>
      </div>
    </main>
  );
}

export default function PrintChartPage() {
  return (
    <Suspense fallback={<PrintChartFallback />}>
      <PrintChartClient />
    </Suspense>
  );
}
