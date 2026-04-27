'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type SavedChart = {
  artist?: string;
  capo?: string;
  chartMode?: string;
  chordChart?: string;
  feel?: string;
  id: string;
  key?: string;
  nashvilleChart?: string;
  notes?: string;
  savedAt?: string;
  tempo?: string;
  timeSignature?: string;
  title?: string;
};

type SortField = 'favorites' | 'recent' | 'title' | 'artist' | 'key';

const STORAGE_KEY = 'nashville-chart-builder:saved-charts';
const FAVORITES_STORAGE_KEY = 'nashville-chart-builder:favorite-charts';

const INPUT_CLASS =
  'w-full rounded-xl border border-amber-950/40 bg-stone-950/70 px-3 py-2.5 text-base text-stone-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';
const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-amber-900/40 bg-stone-950/40 px-3.5 py-2.5 text-sm font-medium text-stone-100 transition hover:bg-stone-900/80 disabled:opacity-50';
const PRIMARY_BUTTON_CLASS =
  'rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300';
const EMPHASIS_BUTTON_CLASS =
  'rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-emerald-300';
const CARD_CLASS = 'rounded-2xl border border-amber-950/30 bg-stone-900/80 p-4 shadow-lg shadow-black/10';

function chartTitle(chart: SavedChart) {
  return chart.title?.trim() || chart.id || 'Untitled Song';
}

function chartArtist(chart: SavedChart) {
  return chart.artist?.trim() || '';
}

function chartSavedTime(chart: SavedChart) {
  const value = chart.savedAt?.trim();
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function formatSavedAt(value?: string) {
  if (!value?.trim()) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function makeCopyTitle(baseTitle: string, charts: SavedChart[]) {
  const cleanTitle = baseTitle.trim() || 'Untitled Song';
  const copyTitle = cleanTitle.endsWith(' Copy') ? cleanTitle : `${cleanTitle} Copy`;
  const existingIds = new Set(charts.map((chart) => chart.id));
  const existingTitles = new Set(charts.map((chart) => chartTitle(chart)));

  if (!existingIds.has(copyTitle) && !existingTitles.has(copyTitle)) {
    return copyTitle;
  }

  let index = 2;
  let nextTitle = `${copyTitle} ${index}`;

  while (existingIds.has(nextTitle) || existingTitles.has(nextTitle)) {
    index += 1;
    nextTitle = `${copyTitle} ${index}`;
  }

  return nextTitle;
}

function compareCharts(first: SavedChart, second: SavedChart, sortField: SortField, favoriteSet: Set<string>) {
  if (sortField === 'favorites') {
    const favoriteDelta = Number(favoriteSet.has(second.id)) - Number(favoriteSet.has(first.id));

    if (favoriteDelta !== 0) {
      return favoriteDelta;
    }

    return chartSavedTime(second) - chartSavedTime(first);
  }

  if (sortField === 'recent') {
    return chartSavedTime(second) - chartSavedTime(first);
  }

  const firstValue =
    sortField === 'title' ? chartTitle(first) : sortField === 'artist' ? chartArtist(first) : first.key || '';
  const secondValue =
    sortField === 'title' ? chartTitle(second) : sortField === 'artist' ? chartArtist(second) : second.key || '';

  return firstValue.localeCompare(secondValue, undefined, { sensitivity: 'base' });
}

function ChartCard({
  chart,
  isFavorite,
  onDelete,
  onDuplicate,
  onOpen,
  onToggleFavorite,
}: {
  chart: SavedChart;
  isFavorite: boolean;
  onDelete: (chart: SavedChart) => void;
  onDuplicate: (chart: SavedChart) => void;
  onOpen: (chart: SavedChart) => void;
  onToggleFavorite: (chart: SavedChart) => void;
}) {
  return (
    <article className={CARD_CLASS}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className={`h-10 w-10 shrink-0 rounded-xl border text-lg transition ${
                isFavorite
                  ? 'border-amber-400 bg-amber-400 text-stone-950'
                  : 'border-amber-900/40 bg-stone-950/40 text-stone-300 hover:bg-stone-900/80'
              }`}
              onClick={() => onToggleFavorite(chart)}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '★' : '☆'}
            </button>
            <div className="min-w-0">
              <h3 className="break-words text-xl font-semibold text-white">{chartTitle(chart)}</h3>
              {chartArtist(chart) ? <p className="mt-1 break-words text-sm text-stone-300">{chartArtist(chart)}</p> : null}
            </div>
          </div>

          <dl className="grid gap-3 text-sm text-stone-300 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Key</dt>
              <dd className="mt-1 text-stone-100">{chart.key || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Time</dt>
              <dd className="mt-1 text-stone-100">{chart.timeSignature || 'N/A'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Last Updated</dt>
              <dd className="mt-1 text-stone-100">{formatSavedAt(chart.savedAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:w-80 lg:grid-cols-1">
          <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={() => onOpen(chart)}>
            Open
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => onDuplicate(chart)}>
            Duplicate
          </button>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => onDelete(chart)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default function LibraryPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('favorites');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [keyFilter, setKeyFilter] = useState('');

  useEffect(() => {
    try {
      const storedCharts = window.localStorage.getItem(STORAGE_KEY);
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      setSavedCharts(storedCharts ? (JSON.parse(storedCharts) as SavedChart[]) : []);
      setFavoriteIds(storedFavorites ? (JSON.parse(storedFavorites) as string[]) : []);
    } catch {
      setSavedCharts([]);
      setFavoriteIds([]);
    } finally {
      setHasMounted(true);
    }
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const keyOptions = useMemo(
    () =>
      Array.from(new Set(savedCharts.map((chart) => chart.key).filter((key): key is string => Boolean(key?.trim())))).sort(
        (first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' })
      ),
    [savedCharts]
  );

  const filteredCharts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return savedCharts.filter((chart) => {
      const matchesSearch =
        !query ||
        chartTitle(chart).toLowerCase().includes(query) ||
        chartArtist(chart).toLowerCase().includes(query) ||
        (chart.key || '').toLowerCase().includes(query);
      const matchesFavorite = !favoritesOnly || favoriteSet.has(chart.id);
      const matchesKey = !keyFilter || chart.key === keyFilter;
      return matchesSearch && matchesFavorite && matchesKey;
    });
  }, [favoriteSet, favoritesOnly, keyFilter, savedCharts, search]);

  const visibleCharts = useMemo(
    () => [...filteredCharts].sort((first, second) => compareCharts(first, second, sortField, favoriteSet)),
    [favoriteSet, filteredCharts, sortField]
  );

  const pinnedFavoriteCharts = useMemo(
    () => [...filteredCharts].filter((chart) => favoriteSet.has(chart.id)).sort((first, second) => chartSavedTime(second) - chartSavedTime(first)),
    [favoriteSet, filteredCharts]
  );

  const recentCharts = useMemo(
    () => [...filteredCharts].sort((first, second) => chartSavedTime(second) - chartSavedTime(first)).slice(0, 5),
    [filteredCharts]
  );

  function persistCharts(nextCharts: SavedChart[]) {
    setSavedCharts(nextCharts);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCharts));
  }

  function persistFavorites(nextFavoriteIds: string[]) {
    setFavoriteIds(nextFavoriteIds);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavoriteIds));
  }

  function handleToggleFavorite(chart: SavedChart) {
    const nextFavoriteIds = favoriteSet.has(chart.id)
      ? favoriteIds.filter((id) => id !== chart.id)
      : [...favoriteIds, chart.id];

    persistFavorites(nextFavoriteIds);
  }

  function handleOpenChart(chart: SavedChart) {
    window.location.href = `/?openChart=${encodeURIComponent(chart.id)}`;
  }

  function handleDuplicateChart(chart: SavedChart) {
    const nextTitle = makeCopyTitle(chartTitle(chart), savedCharts);
    const copiedChart: SavedChart = {
      ...chart,
      id: nextTitle,
      title: nextTitle,
      savedAt: new Date().toISOString(),
    };

    persistCharts([copiedChart, ...savedCharts]);
  }

  function handleDeleteChart(chart: SavedChart) {
    if (!window.confirm(`Delete saved chart "${chartTitle(chart)}"?`)) {
      return;
    }

    persistCharts(savedCharts.filter((item) => item.id !== chart.id));
    persistFavorites(favoriteIds.filter((id) => id !== chart.id));
  }

  function renderCards(charts: SavedChart[]) {
    return charts.map((chart) => (
      <ChartCard
        key={chart.id}
        chart={chart}
        isFavorite={favoriteSet.has(chart.id)}
        onDelete={handleDeleteChart}
        onDuplicate={handleDuplicateChart}
        onOpen={handleOpenChart}
        onToggleFavorite={handleToggleFavorite}
      />
    ));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-8 text-stone-100 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-amber-300/80">Nashville Number System</p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Song Library</h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link href="/setlists" className={SECONDARY_BUTTON_CLASS}>
                Setlists
              </Link>
              <Link href="/" className={SECONDARY_BUTTON_CLASS}>
                Back to Builder
              </Link>
            </nav>
          </div>
        </header>

        <section className="rounded-3xl border border-amber-950/30 bg-stone-900/75 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto] lg:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
              Search
              <input className={INPUT_CLASS} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, artist, or key" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
              Key
              <select className={INPUT_CLASS} value={keyFilter} onChange={(event) => setKeyFilter(event.target.value)}>
                <option value="">All Keys</option>
                {keyOptions.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
              Sort
              <select className={INPUT_CLASS} value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
                <option value="favorites">Favorites First</option>
                <option value="recent">Recently Updated</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="key">Key</option>
              </select>
            </label>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-amber-950/40 bg-stone-950/50 px-4 py-3 text-sm font-medium text-zinc-200">
              <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
              Favorites only
            </label>
          </div>
        </section>

        {!hasMounted ? (
          <section className="rounded-3xl border border-amber-950/30 bg-stone-900/75 p-5 text-sm text-stone-400">Loading saved charts...</section>
        ) : (
          <>
            {pinnedFavoriteCharts.length ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Favorites</h2>
                <div className="grid gap-4">{renderCards(pinnedFavoriteCharts)}</div>
              </section>
            ) : null}

            {recentCharts.length ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Recent Charts</h2>
                <div className="grid gap-4">{renderCards(recentCharts)}</div>
              </section>
            ) : null}

            {visibleCharts.length ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">All Charts</h2>
                <div className="grid gap-4">{renderCards(visibleCharts)}</div>
              </section>
            ) : (
              <section className="rounded-3xl border border-amber-950/30 bg-stone-900/75 p-5 text-sm leading-6 text-stone-300">
                No saved charts match the current library view.
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
