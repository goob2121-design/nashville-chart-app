'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGate, BrandHeaderTitle } from '../components/AuthGate';
import {
  dedupeCharts,
  deleteCloudChart,
  fetchCloudCharts,
  fetchCloudSetlists,
  getInitialCloudStatus,
  normalizeChartKey,
  updateCloudChartFavorite,
  upsertCloudChart,
  upsertCloudCharts,
  upsertCloudSetlists,
  type CloudStatus,
} from '../lib/cloudSync';

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

type Setlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
};

type BackupFile = {
  app: 'nashville-chart-builder';
  version: 1;
  exportedAt: string;
  charts: SavedChart[];
  setlists: Setlist[];
  favorites: {
    chartIds: string[];
    setlistIds: string[];
  };
  metadata: {
    chartCount: number;
    setlistCount: number;
  };
};

type SortField = 'favorites' | 'recent' | 'title' | 'artist' | 'key';

const STORAGE_KEY = 'nashville-chart-builder:saved-charts';
const FAVORITES_STORAGE_KEY = 'nashville-chart-builder:favorite-charts';
const SETLISTS_STORAGE_KEY = 'nashville-chart-builder:setlists';
const FAVORITE_SETLISTS_STORAGE_KEY = 'nashville-chart-builder:favorite-setlists';

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
  return chart.title?.trim() || 'Untitled Chart';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSavedChart(value: unknown): value is SavedChart {
  return isRecord(value) && typeof value.id === 'string';
}

function isSetlist(value: unknown): value is Setlist {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.songIds) &&
    value.songIds.every((songId) => typeof songId === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateBackupFile(value: unknown): BackupFile | null {
  if (!isRecord(value) || value.app !== 'nashville-chart-builder' || value.version !== 1) {
    return null;
  }

  if (!Array.isArray(value.charts) || !value.charts.every(isSavedChart)) {
    return null;
  }

  if (!Array.isArray(value.setlists) || !value.setlists.every(isSetlist)) {
    return null;
  }

  if (!isRecord(value.favorites) || !isStringArray(value.favorites.chartIds) || !isStringArray(value.favorites.setlistIds)) {
    return null;
  }

  return value as BackupFile;
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
  onShare,
  onToggleFavorite,
}: {
  chart: SavedChart;
  isFavorite: boolean;
  onDelete: (chart: SavedChart) => void;
  onDuplicate: (chart: SavedChart) => void;
  onOpen: (chart: SavedChart) => void;
  onShare: (chart: SavedChart) => void;
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
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => onShare(chart)}>
            Share Link
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

function RecentShortcutCard({
  chart,
  isFavorite,
  onOpen,
}: {
  chart: SavedChart;
  isFavorite: boolean;
  onOpen: (chart: SavedChart) => void;
}) {
  return (
    <article className="flex min-w-64 flex-col justify-between gap-3 rounded-2xl border border-amber-950/30 bg-stone-950/55 p-3 shadow-lg shadow-black/10 sm:min-w-72">
      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-5 text-white">{chartTitle(chart)}</h3>
          {isFavorite ? <span className="shrink-0 text-amber-300">★</span> : null}
        </div>
        {chartArtist(chart) ? <p className="truncate text-xs text-stone-300">{chartArtist(chart)}</p> : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-400">
          <span>Key {chart.key || 'N/A'}</span>
          {chart.timeSignature ? <span>{chart.timeSignature}</span> : null}
        </div>
        <p className="text-xs text-stone-500">{formatSavedAt(chart.savedAt)}</p>
      </div>
      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => onOpen(chart)}>
        Open
      </button>
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
  const [backupMessage, setBackupMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(getInitialCloudStatus());
  const [cloudMessage, setCloudMessage] = useState('');

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const storedCharts = window.localStorage.getItem(STORAGE_KEY);
        const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
        const localCharts = dedupeCharts(storedCharts ? (JSON.parse(storedCharts) as SavedChart[]) : []);
        const localFavorites = storedFavorites ? (JSON.parse(storedFavorites) as string[]) : [];

        setSavedCharts(localCharts);
        setFavoriteIds(localFavorites);

        if (getInitialCloudStatus().connected) {
          const cloudResult = await fetchCloudCharts();

          if (cloudResult.error) {
            setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${cloudResult.error}` });
            setCloudMessage('Supabase is unavailable right now. Showing local library data.');
          } else {
            const cloudCharts = dedupeCharts(cloudResult.charts);
            setSavedCharts(cloudCharts);
            setFavoriteIds(cloudResult.favoriteIds);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudCharts));
            window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cloudResult.favoriteIds));
            setCloudStatus({ connected: true, label: 'Connected', message: 'Cloud Sync: Connected' });
            setCloudMessage('');
          }
        }
      } catch {
        setSavedCharts([]);
        setFavoriteIds([]);
        setCloudStatus({ connected: false, label: 'Local Only', message: 'Cloud Sync: Local Only. Local library could not be loaded.' });
      } finally {
        setHasMounted(true);
      }
    };

    void loadLibrary();
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const libraryCharts = useMemo(() => dedupeCharts(savedCharts), [savedCharts]);

  const keyOptions = useMemo(
    () =>
      Array.from(new Set(libraryCharts.map((chart) => chart.key).filter((key): key is string => Boolean(key?.trim())))).sort(
        (first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' })
      ),
    [libraryCharts]
  );

  const filteredCharts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return libraryCharts.filter((chart) => {
      const matchesSearch =
        !query ||
        chartTitle(chart).toLowerCase().includes(query) ||
        chartArtist(chart).toLowerCase().includes(query) ||
        (chart.key || '').toLowerCase().includes(query);
      const matchesFavorite = !favoritesOnly || favoriteSet.has(chart.id);
      const matchesKey = !keyFilter || chart.key === keyFilter;
      return matchesSearch && matchesFavorite && matchesKey;
    });
  }, [favoriteSet, favoritesOnly, keyFilter, libraryCharts, search]);

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
    const dedupedCharts = dedupeCharts(nextCharts);
    setSavedCharts(dedupedCharts);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupedCharts));
  }

  function persistFavorites(nextFavoriteIds: string[]) {
    setFavoriteIds(nextFavoriteIds);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavoriteIds));
  }

  function readStoredSetlists() {
    const storedSetlists = window.localStorage.getItem(SETLISTS_STORAGE_KEY);
    return storedSetlists ? (JSON.parse(storedSetlists) as Setlist[]) : [];
  }

  function readStoredFavoriteSetlists() {
    const storedFavorites = window.localStorage.getItem(FAVORITE_SETLISTS_STORAGE_KEY);
    return storedFavorites ? (JSON.parse(storedFavorites) as string[]) : [];
  }

  async function handleToggleFavorite(chart: SavedChart) {
    const nextIsFavorite = !favoriteSet.has(chart.id);
    const nextFavoriteIds = favoriteSet.has(chart.id)
      ? favoriteIds.filter((id) => id !== chart.id)
      : [...favoriteIds, chart.id];

    persistFavorites(nextFavoriteIds);

    if (cloudStatus.connected) {
      const result = await updateCloudChartFavorite(chart.id, nextIsFavorite);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Favorite updated locally. Cloud sync failed.');
      }
    }
  }

  function handleOpenChart(chart: SavedChart) {
    window.location.href = `/?openChart=${encodeURIComponent(chart.id)}`;
  }

  async function handleShareChart(chart: SavedChart) {
    const url = `${window.location.origin}/?chart=${encodeURIComponent(JSON.stringify(chart))}`;
    setShareUrl(url);

    try {
      await navigator.clipboard.writeText(url);
      setBackupMessage(`Share link copied for "${chartTitle(chart)}".`);
    } catch {
      setBackupMessage(`Share link ready for "${chartTitle(chart)}".`);
    }
  }

  async function handleDuplicateChart(chart: SavedChart) {
    const nextTitle = makeCopyTitle(chartTitle(chart), savedCharts);
    const copiedChart: SavedChart = {
      ...chart,
      id: nextTitle,
      title: nextTitle,
      savedAt: new Date().toISOString(),
    };

    persistCharts([copiedChart, ...savedCharts]);

    if (cloudStatus.connected) {
      const result = await upsertCloudChart(copiedChart);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Duplicated locally. Cloud sync failed.');
      } else if (result.chart && result.chart.id !== copiedChart.id) {
        const cloudCharts = [result.chart, ...savedCharts.filter((item) => item.id !== copiedChart.id)];
        persistCharts(cloudCharts);
        setCloudMessage('Duplicated and synced. Local copy ID was updated to the cloud UUID.');
      }
    }
  }

  async function handleDeleteChart(chart: SavedChart) {
    if (!window.confirm(`Delete saved chart "${chartTitle(chart)}"?`)) {
      return;
    }

    persistCharts(savedCharts.filter((item) => item.id !== chart.id));
    persistFavorites(favoriteIds.filter((id) => id !== chart.id));

    if (cloudStatus.connected) {
      const result = await deleteCloudChart(chart.id);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Deleted locally. Cloud delete failed.');
      }
    }
  }

  function handleExportBackup() {
    try {
      const setlists = readStoredSetlists();
      const favoriteSetlistIds = readStoredFavoriteSetlists();
      const backup: BackupFile = {
        app: 'nashville-chart-builder',
        version: 1,
        exportedAt: new Date().toISOString(),
        charts: savedCharts,
        setlists,
        favorites: {
          chartIds: favoriteIds,
          setlistIds: favoriteSetlistIds,
        },
        metadata: {
          chartCount: savedCharts.length,
          setlistCount: setlists.length,
        },
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nashville-chart-builder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage('Backup exported.');
    } catch {
      setBackupMessage('Backup export failed.');
    }
  }

  async function handleImportBackup(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = validateBackupFile(JSON.parse(await file.text()));

      if (!parsed) {
        setBackupMessage('Import failed. This is not a valid Pinnacle Recording Studio Chart System backup.');
        return;
      }

      const existingSetlists = readStoredSetlists();
      const hasExistingData = savedCharts.length > 0 || favoriteIds.length > 0 || existingSetlists.length > 0;

      if (hasExistingData && !window.confirm('Importing this backup will overwrite existing saved charts, setlists, and favorites on this device. Continue?')) {
        setBackupMessage('Import canceled.');
        return;
      }

      setSavedCharts(parsed.charts);
      setFavoriteIds(parsed.favorites.chartIds);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.charts));
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(parsed.favorites.chartIds));
      window.localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(parsed.setlists));
      window.localStorage.setItem(FAVORITE_SETLISTS_STORAGE_KEY, JSON.stringify(parsed.favorites.setlistIds));
      setBackupMessage(`Imported ${parsed.charts.length} chart${parsed.charts.length === 1 ? '' : 's'} and ${parsed.setlists.length} setlist${parsed.setlists.length === 1 ? '' : 's'}.`);
    } catch {
      setBackupMessage('Import failed. Check that the file is valid JSON.');
    }
  }

  async function handleSyncLocalToCloud() {
    if (!cloudStatus.connected) {
      setCloudMessage('Cloud Sync is Local Only. Add Supabase env vars and make sure Supabase is reachable.');
      return;
    }

    try {
      const storedCharts = window.localStorage.getItem(STORAGE_KEY);
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const localCharts = storedCharts ? (JSON.parse(storedCharts) as SavedChart[]) : [];
      const localFavorites = storedFavorites ? (JSON.parse(storedFavorites) as string[]) : [];
      const localSetlists = readStoredSetlists();
      const localFavoriteSetlists = readStoredFavoriteSetlists();
      const [cloudChartsResult, cloudSetlistsResult] = await Promise.all([fetchCloudCharts(), fetchCloudSetlists()]);

      if (cloudChartsResult.error || cloudSetlistsResult.error) {
        setCloudStatus({
          connected: false,
          label: 'Local Only',
          message: `Cloud Sync: Local Only. ${cloudChartsResult.error || cloudSetlistsResult.error}`,
        });
        setCloudMessage('Could not read cloud data. Local data was not uploaded.');
        return;
      }

      const cloudChartIds = new Set(cloudChartsResult.charts.map((chart) => chart.id));
      const cloudChartKeys = new Set(cloudChartsResult.charts.map(normalizeChartKey));
      const chartsToUpload = localCharts.filter(
        (chart) =>
          !cloudChartIds.has(chart.id) &&
          !cloudChartKeys.has(normalizeChartKey(chart))
      );
      const cloudSetlistIds = new Set(cloudSetlistsResult.setlists.map((setlist) => setlist.id));
      const setlistsToUpload = localSetlists.filter((setlist) => !cloudSetlistIds.has(setlist.id));

      const chartsResult = await upsertCloudCharts(chartsToUpload, localFavorites);

      if (!chartsResult.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${chartsResult.error}` });
        setCloudMessage('Chart migration failed. Local data is unchanged.');
        return;
      }

      const chartIdMap = chartsResult.idMap;
      for (const localChart of localCharts) {
        const existingCloudChart = cloudChartsResult.charts.find(
          (chart) =>
            chart.id === localChart.id ||
            normalizeChartKey(chart) === normalizeChartKey(localChart)
        );

        if (existingCloudChart) {
          chartIdMap.set(localChart.id, existingCloudChart.id);
        }
      }
      const migratedCharts = localCharts.map((chart) => {
        const cloudChart = [...chartsResult.charts, ...cloudChartsResult.charts].find((item) => item.id === chartIdMap.get(chart.id));
        return cloudChart ?? chart;
      });
      const migratedFavoriteIds = localFavorites.map((id) => chartIdMap.get(id) ?? id);
      const migratedSetlists = localSetlists.map((setlist) => ({
        ...setlist,
        songIds: setlist.songIds.map((songId) => chartIdMap.get(songId) ?? songId),
      }));
      const setlistsResult = await upsertCloudSetlists(migratedSetlists.filter((setlist) => !cloudSetlistIds.has(setlist.id)), localFavoriteSetlists, chartIdMap);

      if (!setlistsResult.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${setlistsResult.error}` });
        setCloudMessage('Setlist migration failed. Local data is unchanged.');
        return;
      }

      const setlistIdMap = setlistsResult.idMap;
      const finalSetlists = migratedSetlists.map((setlist) => {
        const cloudSetlist = setlistsResult.setlists.find((item) => item.id === setlistIdMap.get(setlist.id));
        return cloudSetlist ?? setlist;
      });
      const finalFavoriteSetlistIds = localFavoriteSetlists.map((id) => setlistIdMap.get(id) ?? id);

      setSavedCharts(migratedCharts);
      setFavoriteIds(migratedFavoriteIds);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedCharts));
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(migratedFavoriteIds));
      window.localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(finalSetlists));
      window.localStorage.setItem(FAVORITE_SETLISTS_STORAGE_KEY, JSON.stringify(finalFavoriteSetlistIds));
      setCloudMessage(`Synced ${chartsToUpload.length} chart${chartsToUpload.length === 1 ? '' : 's'} and ${setlistsToUpload.length} setlist${setlistsToUpload.length === 1 ? '' : 's'} to cloud.${setlistsResult.skippedItems ? ` Skipped ${setlistsResult.skippedItems} setlist item${setlistsResult.skippedItems === 1 ? '' : 's'} without cloud UUIDs.` : ''}`);
    } catch {
      setCloudStatus({ connected: false, label: 'Local Only', message: 'Cloud Sync: Local Only. Migration failed.' });
      setCloudMessage('Migration failed. Local data is unchanged.');
    }
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
        onShare={handleShareChart}
        onToggleFavorite={handleToggleFavorite}
      />
    ));
  }

  function renderRecentShortcuts(charts: SavedChart[]) {
    return charts.map((chart) => (
      <RecentShortcutCard key={chart.id} chart={chart} isFavorite={favoriteSet.has(chart.id)} onOpen={handleOpenChart} />
    ));
  }

  return (
    <AuthGate>
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-8 text-stone-100 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <BrandHeaderTitle />
              <p className={`inline-flex rounded-xl border px-3 py-2 text-sm ${cloudStatus.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
                {cloudStatus.message}
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link href="/setlists" className={SECONDARY_BUTTON_CLASS}>
                Setlists
              </Link>
              <Link href="/" className={SECONDARY_BUTTON_CLASS}>
                Back to Chart System
              </Link>
            </nav>
          </div>
        </header>

        <section className="rounded-3xl border border-amber-950/30 bg-stone-900/75 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-5">
          <div className="mb-4 grid gap-3 border-b border-amber-950/30 pb-4 lg:grid-cols-[auto_auto_minmax(0,1fr)] lg:items-center">
            <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleExportBackup} disabled={!hasMounted}>
              Export Backup
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleSyncLocalToCloud} disabled={!hasMounted || !cloudStatus.connected}>
              Sync Local Charts to Cloud
            </button>
            <label className={`${SECONDARY_BUTTON_CLASS} cursor-pointer text-center`}>
              Import Backup
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  void handleImportBackup(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
              />
            </label>
            <div className="min-w-0 space-y-2">
              {backupMessage ? <p className="text-sm text-stone-300">{backupMessage}</p> : null}
              {cloudMessage ? <p className="text-sm text-stone-300">{cloudMessage}</p> : null}
              {shareUrl ? (
                <a href={shareUrl} className="block break-all text-sm text-amber-200">
                  {shareUrl}
                </a>
              ) : null}
            </div>
          </div>

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
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Recent Shortcuts</h2>
                  <p className="text-xs leading-5 text-stone-400">Quick access to recently updated charts. Full cards live in All Charts below.</p>
                </div>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                  {renderRecentShortcuts(recentCharts)}
                </div>
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
    </AuthGate>
  );
}
