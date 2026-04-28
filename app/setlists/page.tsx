'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGate, BrandHeaderTitle } from '../components/AuthGate';
import {
  deleteCloudSetlist,
  fetchCloudCharts,
  fetchCloudSetlists,
  getInitialCloudStatus,
  isUuid,
  updateCloudSetlistFavorite,
  upsertCloudSetlist,
  type CloudStatus,
} from '../lib/cloudSync';

type SavedChart = {
  audioPath?: string;
  audioUrl?: string;
  artist?: string;
  capo?: string;
  id: string;
  key?: string;
  notes?: string;
  savedAt?: string;
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

type SharedSetlistData = {
  setlist: Setlist;
  charts: SavedChart[];
  sharedAt: string;
};

const CHARTS_STORAGE_KEY = 'nashville-chart-builder:saved-charts';
const SETLISTS_STORAGE_KEY = 'nashville-chart-builder:setlists';
const FAVORITE_SETLISTS_STORAGE_KEY = 'nashville-chart-builder:favorite-setlists';

const INPUT_CLASS =
  'w-full rounded-xl border border-amber-950/40 bg-stone-950/70 px-3 py-2.5 text-base text-stone-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';
const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-amber-900/40 bg-stone-950/40 px-3.5 py-2.5 text-sm font-medium text-stone-100 transition hover:bg-stone-900/80 disabled:opacity-50 print:hidden';
const PRIMARY_BUTTON_CLASS =
  'rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:opacity-50 print:hidden';
const EMPHASIS_BUTTON_CLASS =
  'rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-emerald-300 disabled:opacity-50 print:hidden';

function chartTitle(chart?: SavedChart) {
  return chart?.title?.trim() || chart?.id || 'Missing song';
}

function chartArtist(chart?: SavedChart) {
  return chart?.artist?.trim() || '';
}

function chartHasAudio(chart?: SavedChart) {
  return Boolean(chart?.audioUrl?.trim() || chart?.audioPath?.trim());
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function uniqueName(baseName: string, setlists: Setlist[]) {
  const cleanName = baseName.trim() || 'Untitled Setlist';
  const names = new Set(setlists.map((setlist) => setlist.name));

  if (!names.has(cleanName)) {
    return cleanName;
  }

  let index = 2;
  let nextName = `${cleanName} ${index}`;

  while (names.has(nextName)) {
    index += 1;
    nextName = `${cleanName} ${index}`;
  }

  return nextName;
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

function deserializeSharedSetlist(value: string) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;

    if (!isRecord(parsed) || !isSetlist(parsed.setlist) || !Array.isArray(parsed.charts) || !parsed.charts.every(isSavedChart)) {
      return null;
    }

    return {
      setlist: parsed.setlist,
      charts: parsed.charts,
      sharedAt: typeof parsed.sharedAt === 'string' ? parsed.sharedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function SetlistReadOnlyView({ data }: { data: SharedSetlistData }) {
  const chartMap = new Map(data.charts.map((chart) => [chart.id, chart]));

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 print:max-w-none print:gap-4">
        <header className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Shared Setlist</p>
            <h1 className="text-3xl font-semibold text-white">{data.setlist.name}</h1>
          </div>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            onClick={() => window.print()}
          >
            Print
          </button>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-black/70 p-6 shadow-xl shadow-black/20 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
          <h2 className="text-2xl font-semibold text-white print:text-black">{data.setlist.name}</h2>
          <ol className="mt-5 space-y-3 print:list-decimal print:space-y-2 print:pl-6">
            {data.setlist.songIds.length ? (
              data.setlist.songIds.map((songId, index) => {
                const chart = chartMap.get(songId);

                return (
                  <li key={`${songId}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 print:rounded-none print:border-0 print:bg-white print:p-0">
                    <div className="flex flex-wrap items-center gap-2 print:inline">
                      <h3 className="text-lg font-semibold text-white print:inline print:text-base print:text-black">{chartTitle(chart)}</h3>
                      {chartHasAudio(chart) ? (
                        <span className="no-print rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                          MP3
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-zinc-300 print:inline print:text-black">
                      {chart ? (
                        <>
                          {chart.key ? `Key: ${chart.key}` : 'Key: N/A'}
                          {chart.capo?.trim() ? ` | Capo: ${chart.capo}` : ''}
                        </>
                      ) : (
                        'Missing song'
                      )}
                    </p>
                    {chart?.notes?.trim() ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300 print:mt-1 print:text-black">Notes: {chart.notes}</p>
                    ) : null}
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-zinc-400 print:text-black">No songs in this setlist.</li>
            )}
          </ol>
        </section>
      </div>
    </main>
  );
}

export default function SetlistsPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [favoriteSetlistIds, setFavoriteSetlistIds] = useState<string[]>([]);
  const [newSetlistName, setNewSetlistName] = useState('');
  const [selectedSetlistId, setSelectedSetlistId] = useState('');
  const [selectedSongId, setSelectedSongId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [sharedSetlistData, setSharedSetlistData] = useState<SharedSetlistData | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(getInitialCloudStatus());
  const [cloudMessage, setCloudMessage] = useState('');

  useEffect(() => {
    const loadSetlists = async () => {
      try {
      const params = new URLSearchParams(window.location.search);
      const sharedSetlist = params.get('shareSetlist');

      if (sharedSetlist) {
        setSharedSetlistData(deserializeSharedSetlist(sharedSetlist));
        return;
      }

      const storedCharts = window.localStorage.getItem(CHARTS_STORAGE_KEY);
      const storedSetlists = window.localStorage.getItem(SETLISTS_STORAGE_KEY);
      const storedFavorites = window.localStorage.getItem(FAVORITE_SETLISTS_STORAGE_KEY);
      const parsedSetlists = storedSetlists ? (JSON.parse(storedSetlists) as Setlist[]) : [];

      setCharts(storedCharts ? (JSON.parse(storedCharts) as SavedChart[]) : []);
      setSetlists(parsedSetlists);
      setFavoriteSetlistIds(storedFavorites ? (JSON.parse(storedFavorites) as string[]) : []);
      setSelectedSetlistId(parsedSetlists[0]?.id ?? '');
      setRenameValue(parsedSetlists[0]?.name ?? '');

      if (getInitialCloudStatus().connected) {
        const [cloudChartsResult, cloudSetlistsResult] = await Promise.all([fetchCloudCharts(), fetchCloudSetlists()]);

        if (cloudChartsResult.error || cloudSetlistsResult.error) {
          setCloudStatus({
            connected: false,
            label: 'Local Only',
            message: `Cloud Sync: Local Only. ${cloudChartsResult.error || cloudSetlistsResult.error}`,
          });
          setCloudMessage('Supabase is unavailable right now. Showing local setlist data.');
        } else {
          setCharts(cloudChartsResult.charts);
          setSetlists(cloudSetlistsResult.setlists);
          setFavoriteSetlistIds(cloudSetlistsResult.favoriteIds);
          setSelectedSetlistId(cloudSetlistsResult.setlists[0]?.id ?? '');
          setRenameValue(cloudSetlistsResult.setlists[0]?.name ?? '');
          window.localStorage.setItem(CHARTS_STORAGE_KEY, JSON.stringify(cloudChartsResult.charts));
          window.localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(cloudSetlistsResult.setlists));
          window.localStorage.setItem(FAVORITE_SETLISTS_STORAGE_KEY, JSON.stringify(cloudSetlistsResult.favoriteIds));
          setCloudStatus({ connected: true, label: 'Connected', message: 'Cloud Sync: Connected' });
          setCloudMessage('');
        }
      }
    } catch {
      setCharts([]);
      setSetlists([]);
      setFavoriteSetlistIds([]);
      setSelectedSetlistId('');
      setRenameValue('');
      setCloudStatus({ connected: false, label: 'Local Only', message: 'Cloud Sync: Local Only. Setlists could not be loaded.' });
    } finally {
      setHasMounted(true);
    }
    };

    void loadSetlists();
  }, []);

  const chartMap = useMemo(() => new Map(charts.map((chart) => [chart.id, chart])), [charts]);
  const favoriteSetlistSet = useMemo(() => new Set(favoriteSetlistIds), [favoriteSetlistIds]);
  const sortedCharts = useMemo(
    () => [...charts].sort((first, second) => chartTitle(first).localeCompare(chartTitle(second), undefined, { sensitivity: 'base' })),
    [charts]
  );
  const sortedSetlists = useMemo(
    () =>
      [...setlists].sort((first, second) => {
        const favoriteDelta = Number(favoriteSetlistSet.has(second.id)) - Number(favoriteSetlistSet.has(first.id));

        if (favoriteDelta !== 0) {
          return favoriteDelta;
        }

        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
      }),
    [favoriteSetlistSet, setlists]
  );
  const selectedSetlist = setlists.find((setlist) => setlist.id === selectedSetlistId) ?? null;

  function persistSetlists(nextSetlists: Setlist[], nextSelectedId = selectedSetlistId) {
    setSetlists(nextSetlists);
    window.localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(nextSetlists));
    setSelectedSetlistId(nextSelectedId);
    setRenameValue(nextSetlists.find((setlist) => setlist.id === nextSelectedId)?.name ?? '');
  }

  function persistFavoriteSetlists(nextFavoriteIds: string[]) {
    setFavoriteSetlistIds(nextFavoriteIds);
    window.localStorage.setItem(FAVORITE_SETLISTS_STORAGE_KEY, JSON.stringify(nextFavoriteIds));
  }

  async function updateSelectedSetlist(updater: (setlist: Setlist) => Setlist) {
    if (!selectedSetlist) {
      return;
    }

    const nextSetlist = updater(selectedSetlist);
    persistSetlists(setlists.map((setlist) => (setlist.id === selectedSetlist.id ? nextSetlist : setlist)), nextSetlist.id);

    if (cloudStatus.connected) {
      const result = await upsertCloudSetlist(nextSetlist, favoriteSetlistSet.has(nextSetlist.id));

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Setlist saved locally. Cloud sync failed.');
      } else if (result.setlist && result.setlist.id !== nextSetlist.id) {
        persistSetlists(setlists.map((setlist) => (setlist.id === selectedSetlist.id ? result.setlist as Setlist : setlist)), result.setlist.id);
        setCloudMessage(`Setlist synced. Local setlist ID was updated to the cloud UUID.${result.skippedItems ? ` Skipped ${result.skippedItems} song${result.skippedItems === 1 ? '' : 's'} without cloud UUIDs.` : ''}`);
      } else if (result.skippedItems) {
        setCloudMessage(`Setlist synced, but skipped ${result.skippedItems} song${result.skippedItems === 1 ? '' : 's'} without cloud UUIDs.`);
      }
    }
  }

  function handleSelectSetlist(id: string) {
    const nextSetlist = setlists.find((setlist) => setlist.id === id);
    setSelectedSetlistId(id);
    setRenameValue(nextSetlist?.name ?? '');
  }

  async function handleCreateSetlist() {
    const now = new Date().toISOString();
    const nextSetlist: Setlist = {
      id: makeId('setlist'),
      name: uniqueName(newSetlistName || 'New Setlist', setlists),
      songIds: [],
      createdAt: now,
      updatedAt: now,
    };

    persistSetlists([nextSetlist, ...setlists], nextSetlist.id);
    setNewSetlistName('');

    if (cloudStatus.connected) {
      const result = await upsertCloudSetlist(nextSetlist);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Setlist created locally. Cloud sync failed.');
      } else if (result.setlist && result.setlist.id !== nextSetlist.id) {
        persistSetlists([result.setlist, ...setlists], result.setlist.id);
        setCloudMessage('Setlist created in cloud. Local setlist ID was updated to the cloud UUID.');
      }
    }
  }

  function handleRenameSetlist() {
    const nextName = renameValue.trim();

    if (!selectedSetlist || !nextName) {
      return;
    }

    void updateSelectedSetlist((setlist) => ({ ...setlist, name: nextName, updatedAt: new Date().toISOString() }));
  }

  async function handleDeleteSetlist(setlist: Setlist) {
    if (!window.confirm(`Delete setlist "${setlist.name}"?`)) {
      return;
    }

    const nextSetlists = setlists.filter((item) => item.id !== setlist.id);
    const nextSelectedId = nextSetlists[0]?.id ?? '';

    persistSetlists(nextSetlists, nextSelectedId);
    persistFavoriteSetlists(favoriteSetlistIds.filter((id) => id !== setlist.id));

    if (cloudStatus.connected) {
      const result = await deleteCloudSetlist(setlist.id);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Setlist deleted locally. Cloud delete failed.');
      }
    }
  }

  async function handleDuplicateSetlist(setlist: Setlist) {
    const now = new Date().toISOString();
    const duplicatedSetlist: Setlist = {
      ...setlist,
      id: makeId('setlist'),
      name: uniqueName(`${setlist.name} Copy`, setlists),
      createdAt: now,
      updatedAt: now,
    };

    persistSetlists([duplicatedSetlist, ...setlists], duplicatedSetlist.id);

    if (cloudStatus.connected) {
      const result = await upsertCloudSetlist(duplicatedSetlist);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Setlist duplicated locally. Cloud sync failed.');
      } else if (result.setlist && result.setlist.id !== duplicatedSetlist.id) {
        persistSetlists([result.setlist, ...setlists], result.setlist.id);
        setCloudMessage(`Setlist duplicated in cloud. Local setlist ID was updated to the cloud UUID.${result.skippedItems ? ` Skipped ${result.skippedItems} song${result.skippedItems === 1 ? '' : 's'} without cloud UUIDs.` : ''}`);
      }
    }
  }

  async function handleToggleFavorite(setlist: Setlist) {
    const nextIsFavorite = !favoriteSetlistSet.has(setlist.id);
    const nextFavoriteIds = favoriteSetlistSet.has(setlist.id)
      ? favoriteSetlistIds.filter((id) => id !== setlist.id)
      : [...favoriteSetlistIds, setlist.id];

    persistFavoriteSetlists(nextFavoriteIds);

    if (cloudStatus.connected) {
      const result = await updateCloudSetlistFavorite(setlist.id, nextIsFavorite);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Favorite updated locally. Cloud sync failed.');
      }
    }
  }

  function handleAddSong() {
    if (!selectedSongId) {
      return;
    }

    void updateSelectedSetlist((setlist) => ({
      ...setlist,
      songIds: [...setlist.songIds, selectedSongId],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedSongId('');
  }

  function handleRemoveSong(index: number) {
    void updateSelectedSetlist((setlist) => ({
      ...setlist,
      songIds: setlist.songIds.filter((_, songIndex) => songIndex !== index),
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleMoveSong(index: number, direction: -1 | 1) {
    void updateSelectedSetlist((setlist) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= setlist.songIds.length) {
        return setlist;
      }

      const nextSongIds = [...setlist.songIds];
      const currentSongId = nextSongIds[index];
      nextSongIds[index] = nextSongIds[nextIndex];
      nextSongIds[nextIndex] = currentSongId;

      return { ...setlist, songIds: nextSongIds, updatedAt: new Date().toISOString() };
    });
  }

  function handleOpenSong(songId: string) {
    window.location.href = `/?openChart=${encodeURIComponent(songId)}`;
  }

  function handleOpenAdjacentSong(index: number, direction: -1 | 1) {
    if (!selectedSetlist) {
      return;
    }

    const nextSongId = selectedSetlist.songIds[index + direction];

    if (nextSongId && chartMap.has(nextSongId)) {
      handleOpenSong(nextSongId);
    }
  }

  async function handleShareSetlist() {
    if (!selectedSetlist) {
      return;
    }

    if (!cloudStatus.connected) {
      setShareUrl('');
      setShareMessage('Cloud sync is required for short share links.');
      return;
    }

    if (!isUuid(selectedSetlist.id)) {
      setShareUrl('');
      setShareMessage('Save this setlist to cloud before sharing.');
      return;
    }

    const url = `${window.location.origin}/share/setlist/${selectedSetlist.id}`;

    setShareUrl(url);

    try {
      await navigator.clipboard.writeText(url);
      setShareMessage('Copied!');
    } catch {
      setShareMessage('Copy failed. Use the link below.');
    }
  }

  if (sharedSetlistData) {
    return <SetlistReadOnlyView data={sharedSetlistData} />;
  }

  return (
    <AuthGate>
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-8 text-stone-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          .no-print,
          button,
          input,
          select {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 print:max-w-none print:gap-4">
        <header className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <BrandHeaderTitle />
            <p className={`inline-flex rounded-xl border px-3 py-2 text-sm ${cloudStatus.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
              {cloudStatus.message}
            </p>
            {cloudMessage ? <p className="text-sm text-stone-300">{cloudMessage}</p> : null}
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href="/library" className={SECONDARY_BUTTON_CLASS}>
              Song Library
            </Link>
            <Link href="/" className={SECONDARY_BUTTON_CLASS}>
              Back to Chart System
            </Link>
          </nav>
        </header>

        {!hasMounted ? (
          <section className="rounded-3xl border border-amber-950/30 bg-stone-900/75 p-5 text-sm text-stone-400 print:hidden">
            Loading setlists...
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] print:block">
            <aside className="no-print space-y-4 rounded-3xl border border-amber-950/30 bg-stone-900/75 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-5">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Create Setlist</h2>
                <input
                  className={INPUT_CLASS}
                  value={newSetlistName}
                  onChange={(event) => setNewSetlistName(event.target.value)}
                  placeholder="Setlist name"
                />
                <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleCreateSetlist}>
                  Create Setlist
                </button>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Saved Setlists</h2>
                {sortedSetlists.length ? (
                  <div className="space-y-2">
                    {sortedSetlists.map((setlist) => {
                      const isSelected = setlist.id === selectedSetlistId;
                      const isFavorite = favoriteSetlistSet.has(setlist.id);

                      return (
                        <button
                          key={setlist.id}
                          type="button"
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/15'
                              : 'border-amber-950/30 bg-stone-950/45 hover:bg-stone-950/70'
                          }`}
                          onClick={() => handleSelectSetlist(setlist.id)}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block break-words text-sm font-semibold text-white">{setlist.name}</span>
                              <span className="mt-1 block text-xs text-stone-400">
                                {setlist.songIds.length} song{setlist.songIds.length === 1 ? '' : 's'} - updated {formatUpdatedAt(setlist.updatedAt)}
                              </span>
                            </span>
                            <span className="text-amber-300">{isFavorite ? '★' : ''}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">No setlists yet.</p>
                )}
              </section>
            </aside>

            <section className="rounded-3xl border border-amber-950/30 bg-stone-900/75 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-5 print:border-0 print:bg-white print:p-0 print:shadow-none">
              {selectedSetlist ? (
                <>
                  <div className="no-print space-y-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className={`h-10 w-10 shrink-0 rounded-xl border text-lg transition ${
                              favoriteSetlistSet.has(selectedSetlist.id)
                                ? 'border-amber-400 bg-amber-400 text-stone-950'
                                : 'border-amber-900/40 bg-stone-950/40 text-stone-300 hover:bg-stone-900/80'
                            }`}
                            onClick={() => handleToggleFavorite(selectedSetlist)}
                            aria-label={favoriteSetlistSet.has(selectedSetlist.id) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {favoriteSetlistSet.has(selectedSetlist.id) ? '★' : '☆'}
                          </button>
                          <div>
                            <h2 className="break-words text-2xl font-semibold text-white">{selectedSetlist.name}</h2>
                            <p className="mt-1 text-sm text-stone-400">Updated {formatUpdatedAt(selectedSetlist.updatedAt)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleShareSetlist}>
                          Share Link
                        </button>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => handleDuplicateSetlist(selectedSetlist)}>
                          Duplicate
                        </button>
                        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => window.print()}>
                          Print Setlist
                        </button>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => handleDeleteSetlist(selectedSetlist)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    {shareMessage || shareUrl ? (
                      <section className="rounded-2xl border border-amber-950/25 bg-stone-950/50 p-4">
                        {shareMessage ? <p className="text-sm text-stone-300">{shareMessage}</p> : null}
                        {shareUrl ? (
                          <input className={`${INPUT_CLASS} mt-2`} value={shareUrl} readOnly onFocus={(event) => event.target.select()} aria-label="Setlist share link" />
                        ) : null}
                      </section>
                    ) : null}

                    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                        Rename Setlist
                        <input className={INPUT_CLASS} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                      </label>
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleRenameSetlist} disabled={!renameValue.trim()}>
                        Rename
                      </button>
                    </section>

                    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                        Add Song From Library
                        <select className={INPUT_CLASS} value={selectedSongId} onChange={(event) => setSelectedSongId(event.target.value)}>
                          <option value="">Select a song</option>
                          {sortedCharts.map((chart) => (
                            <option key={chart.id} value={chart.id}>
                              {chartHasAudio(chart) ? '[MP3] ' : ''}{chartTitle(chart)}{chart.key ? ` - ${chart.key}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleAddSong} disabled={!selectedSongId}>
                        Add Song
                      </button>
                    </section>
                  </div>

                  <div className="print-only text-black">
                    <h1 className="text-2xl font-semibold">{selectedSetlist.name}</h1>
                  </div>

                  <ol className="mt-5 space-y-3 print:mt-4 print:list-decimal print:space-y-2 print:pl-6">
                    {selectedSetlist.songIds.length ? (
                      selectedSetlist.songIds.map((songId, index) => {
                        const chart = chartMap.get(songId);
                        const previousSong = selectedSetlist.songIds[index - 1];
                        const nextSong = selectedSetlist.songIds[index + 1];

                        return (
                          <li
                            key={`${songId}-${index}`}
                            className="rounded-2xl border border-amber-950/25 bg-stone-950/45 p-4 print:rounded-none print:border-0 print:bg-white print:p-0"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between print:block">
                              <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.18em] text-stone-500 print:hidden">Song {index + 1}</p>
                                <div className="flex flex-wrap items-center gap-2 print:inline">
                                  <h3 className="break-words text-lg font-semibold text-white print:inline print:text-base print:text-black">
                                    {chartTitle(chart)}
                                  </h3>
                                  {chartHasAudio(chart) ? (
                                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200 print:hidden">
                                      MP3
                                    </span>
                                  ) : null}
                                </div>
                                {chartArtist(chart) ? <p className="mt-1 text-sm text-stone-300 print:hidden">{chartArtist(chart)}</p> : null}
                                <p className="mt-2 text-sm text-stone-300 print:inline print:text-black">
                                  {chart ? (
                                    <>
                                      {chart.key ? `Key: ${chart.key}` : 'Key: N/A'}
                                      {chart.capo?.trim() ? ` | Capo: ${chart.capo}` : ''}
                                    </>
                                  ) : (
                                    'Missing song'
                                  )}
                                </p>
                                {chart?.notes?.trim() ? (
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-300 print:mt-1 print:text-black">
                                    Notes: {chart.notes}
                                  </p>
                                ) : null}
                              </div>

                              <div className="grid gap-2 sm:grid-cols-3 lg:w-72 lg:grid-cols-1 print:hidden">
                                <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={() => handleOpenSong(songId)} disabled={!chart}>
                                  Open
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => handleMoveSong(index, -1)} disabled={index === 0}>
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    onClick={() => handleMoveSong(index, 1)}
                                    disabled={index === selectedSetlist.songIds.length - 1}
                                  >
                                    Down
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    onClick={() => handleOpenAdjacentSong(index, -1)}
                                    disabled={!previousSong || !chartMap.has(previousSong)}
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    onClick={() => handleOpenAdjacentSong(index, 1)}
                                    disabled={!nextSong || !chartMap.has(nextSong)}
                                  >
                                    Next
                                  </button>
                                </div>
                                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => handleRemoveSong(index)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })
                    ) : (
                      <li className="rounded-2xl border border-amber-950/25 bg-stone-950/45 p-4 text-sm text-stone-400 print:hidden">
                        Add songs from the library to build this setlist.
                      </li>
                    )}
                  </ol>
                </>
              ) : (
                <p className="text-sm text-stone-400 print:hidden">Create or select a setlist to begin.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
    </AuthGate>
  );
}
