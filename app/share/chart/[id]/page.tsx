'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PrintableChartView from '../../../components/PrintableChartView';
import { fetchCloudChartById, getChartAudioPublicUrl, type SavedChart } from '../../../lib/cloudSync';

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
  if (message) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-300 bg-white p-6 shadow-lg shadow-stone-900/5">
          <p className="text-sm uppercase tracking-[0.28em] text-stone-500">Shared Chart</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-950">Chart unavailable</h1>
          <p className="mt-3 text-sm text-stone-600">{message}</p>
        </div>
      </main>
    );
  }

  if (!chart) {
    return null;
  }

  return (
    <PrintableChartView
      chart={{
        ...chart,
        audioUrl: audioUrl || chart.audioUrl,
      }}
      heading="Shared Chart"
      homeHref="/"
      homeLabel="Open App"
    />
  );
}
