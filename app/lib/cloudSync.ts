import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SavedChart = {
  audioAnalysis?: unknown;
  audioFilename?: string;
  audioPath?: string;
  audioUrl?: string;
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

export type Setlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CloudStatus = {
  connected: boolean;
  label: 'Connected' | 'Local Only';
  message: string;
};

type ChartRow = {
  id: string;
  audio_filename: string | null;
  audio_path: string | null;
  audio_url: string | null;
  title: string | null;
  artist: string | null;
  key: string | null;
  time_signature: string | null;
  tempo: string | null;
  capo: string | null;
  feel: string | null;
  notes: string | null;
  chord_chart: string | null;
  nashville_chart: string | null;
  chart_mode: string | null;
  updated_at: string | null;
  is_favorite?: boolean | null;
};

type ChartInsertRow = Omit<ChartRow, 'id'> & { id?: string };

type SetlistRow = {
  id: string;
  name: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_favorite?: boolean | null;
};

type SetlistInsertRow = Omit<SetlistRow, 'id'> & { id?: string };

type SetlistItemRow = {
  setlist_id: string;
  chart_id: string;
  position: number;
};

let client: SupabaseClient | null | undefined;

export function isUuid(value: string | undefined | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function normalizeChartKey(chart: Pick<SavedChart, 'artist' | 'key' | 'title'>) {
  const title = (chart.title ?? '').trim().toLowerCase();
  const artist = (chart.artist ?? '').trim().toLowerCase();
  const key = (chart.key ?? '').trim().toLowerCase();

  return `${title}|${artist}|${key}`;
}

function chartUpdatedTime(chart: SavedChart) {
  const time = chart.savedAt ? new Date(chart.savedAt).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

export function dedupeCharts<T extends SavedChart>(charts: T[]) {
  const byId = new Map<string, T>();

  for (const chart of charts) {
    const existing = byId.get(chart.id);

    if (!existing || chartUpdatedTime(chart) >= chartUpdatedTime(existing)) {
      byId.set(chart.id, chart);
    }
  }

  const byChartKey = new Map<string, T>();

  for (const chart of byId.values()) {
    const key = normalizeChartKey(chart);
    const existing = byChartKey.get(key);

    if (!existing || chartUpdatedTime(chart) >= chartUpdatedTime(existing)) {
      byChartKey.set(key, chart);
    }
  }

  return Array.from(byChartKey.values()).sort((first, second) => chartUpdatedTime(second) - chartUpdatedTime(first));
}

export function getSupabaseClient() {
  if (client !== undefined) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  client = url && anonKey ? createClient(url, anonKey) : null;
  return client;
}

export function getInitialCloudStatus(): CloudStatus {
  return getSupabaseClient()
    ? { connected: true, label: 'Connected', message: 'Cloud Sync: Connected' }
    : { connected: false, label: 'Local Only', message: 'Cloud Sync: Local Only. Add Supabase env vars to enable sync.' };
}

function chartToRow(chart: SavedChart, isFavorite = false): ChartInsertRow {
  return {
    ...(isUuid(chart.id) ? { id: chart.id } : {}),
    audio_filename: chart.audioFilename ?? '',
    audio_path: chart.audioPath ?? '',
    audio_url: chart.audioUrl ?? '',
    title: chart.title ?? '',
    artist: chart.artist ?? '',
    key: chart.key ?? '',
    time_signature: chart.timeSignature ?? '',
    tempo: chart.tempo ?? '',
    capo: chart.capo ?? '',
    feel: chart.feel ?? '',
    notes: chart.notes ?? '',
    chord_chart: chart.chordChart ?? '',
    nashville_chart: chart.nashvilleChart ?? '',
    chart_mode: chart.chartMode ?? '',
    updated_at: chart.savedAt ?? new Date().toISOString(),
    is_favorite: isFavorite,
  };
}

function rowToChart(row: ChartRow): SavedChart {
  return {
    audioFilename: row.audio_filename ?? '',
    audioPath: row.audio_path ?? '',
    audioUrl: row.audio_url ?? '',
    id: row.id,
    title: row.title ?? '',
    artist: row.artist ?? '',
    key: row.key ?? '',
    timeSignature: row.time_signature ?? '',
    tempo: row.tempo ?? '',
    capo: row.capo ?? '',
    feel: row.feel ?? '',
    notes: row.notes ?? '',
    chordChart: row.chord_chart ?? '',
    nashvilleChart: row.nashville_chart ?? '',
    chartMode: row.chart_mode ?? '',
    savedAt: row.updated_at ?? '',
  };
}

function setlistToRow(setlist: Setlist, isFavorite = false): SetlistInsertRow {
  return {
    ...(isUuid(setlist.id) ? { id: setlist.id } : {}),
    name: setlist.name,
    created_at: setlist.createdAt,
    updated_at: setlist.updatedAt,
    is_favorite: isFavorite,
  };
}

function rowToSetlist(row: SetlistRow, songIds: string[]): Setlist {
  return {
    id: row.id,
    name: row.name ?? 'Untitled Setlist',
    songIds,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function cloudError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return 'Supabase is unavailable. Using localStorage.';
}

const AUDIO_BUCKET = 'song-audio';

export function getChartAudioPublicUrl(chart: Pick<SavedChart, 'audioPath' | 'audioUrl'>) {
  if ((chart.audioUrl ?? '').trim()) {
    return chart.audioUrl!.trim();
  }

  if (!(chart.audioPath ?? '').trim()) {
    return '';
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return '';
  }

  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(chart.audioPath!.trim()).data.publicUrl;
}

function sanitizeAudioFileName(filename: string) {
  const withoutExtension = filename.replace(/\.mp3$/i, '');
  const safeBaseName = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'chart-audio';

  return `${safeBaseName}.mp3`;
}

export async function uploadChartAudioFile(chartId: string, file: File) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.', audioUrl: '', audioFilename: '', audioPath: '' };
  }

  if (!isUuid(chartId)) {
    return { ok: false, error: 'Chart must be saved to the cloud before uploading audio.', audioUrl: '', audioFilename: '', audioPath: '' };
  }

  if (!/\.mp3$/i.test(file.name) || (file.type && file.type !== 'audio/mpeg')) {
    return { ok: false, error: 'Only MP3 files are supported.', audioUrl: '', audioFilename: '', audioPath: '' };
  }

  const audioFilename = sanitizeAudioFileName(file.name);
  const audioPath = `charts/${chartId}/${Date.now()}-${audioFilename}`;
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(audioPath, file, {
    contentType: 'audio/mpeg',
    upsert: false,
  });

  if (error) {
    return { ok: false, error: cloudError(error), audioUrl: '', audioFilename: '', audioPath: '' };
  }

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath);

  return {
    ok: true,
    error: '',
    audioFilename: file.name,
    audioPath,
    audioUrl: data.publicUrl,
  };
}

export async function removeChartAudioFile(audioPath: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.' };
  }

  if (!audioPath.trim()) {
    return { ok: true, error: '' };
  }

  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([audioPath]);
  return error ? { ok: false, error: cloudError(error) } : { ok: true, error: '' };
}

export async function fetchCloudCharts() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { charts: [] as SavedChart[], favoriteIds: [] as string[], error: 'Missing Supabase env vars.' };
  }

  const { data, error } = await supabase.from('charts').select('*').order('updated_at', { ascending: false });

  if (error) {
    return { charts: [] as SavedChart[], favoriteIds: [] as string[], error: cloudError(error) };
  }

  const rows = (data ?? []) as ChartRow[];

  return {
    charts: rows.map(rowToChart),
    favoriteIds: rows.filter((row) => row.is_favorite).map((row) => row.id),
    error: '',
  };
}

export async function fetchCloudChartById(id: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { chart: null as SavedChart | null, error: 'Missing Supabase env vars.' };
  }

  if (!isUuid(id)) {
    return { chart: null as SavedChart | null, error: 'Invalid chart link.' };
  }

  const { data, error } = await supabase.from('charts').select('*').eq('id', id).single();

  return error
    ? { chart: null as SavedChart | null, error: cloudError(error) }
    : { chart: rowToChart(data as ChartRow), error: '' };
}

export async function upsertCloudChart(chart: SavedChart, isFavorite = false) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.', chart: null as SavedChart | null };
  }

  const row = chartToRow(chart, isFavorite);
  const query = isUuid(chart.id)
    ? supabase.from('charts').upsert(row, { onConflict: 'id' }).select('*').single()
    : supabase.from('charts').insert(row).select('*').single();
  const { data, error } = await query;

  return error
    ? { ok: false, error: cloudError(error), chart: null as SavedChart | null }
    : { ok: true, error: '', chart: rowToChart(data as ChartRow) };
}

export async function upsertCloudCharts(charts: SavedChart[], favoriteIds: string[]) {
  const idMap = new Map<string, string>();
  const uploadedCharts: SavedChart[] = [];
  const favoriteSet = new Set(favoriteIds);

  for (const chart of charts) {
    const result = await upsertCloudChart(chart, favoriteSet.has(chart.id));

    if (!result.ok || !result.chart) {
      return { ok: false, error: result.error, idMap, charts: uploadedCharts };
    }

    idMap.set(chart.id, result.chart.id);
    uploadedCharts.push(result.chart);
  }

  return { ok: true, error: '', idMap, charts: uploadedCharts };
}

export async function deleteCloudChart(id: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.' };
  }

  if (!isUuid(id)) {
    return { ok: true, error: '' };
  }

  const { error } = await supabase.from('charts').delete().eq('id', id);
  return error ? { ok: false, error: cloudError(error) } : { ok: true, error: '' };
}

export async function updateCloudChartFavorite(id: string, isFavorite: boolean) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.' };
  }

  if (!isUuid(id)) {
    return { ok: true, error: '' };
  }

  const { error } = await supabase.from('charts').update({ is_favorite: isFavorite }).eq('id', id);
  return error ? { ok: false, error: cloudError(error) } : { ok: true, error: '' };
}

export async function fetchCloudSetlists() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { setlists: [] as Setlist[], favoriteIds: [] as string[], error: 'Missing Supabase env vars.' };
  }

  const [{ data: setlistRows, error: setlistsError }, { data: itemRows, error: itemsError }] = await Promise.all([
    supabase.from('setlists').select('*').order('updated_at', { ascending: false }),
    supabase.from('setlist_items').select('*').order('position', { ascending: true }),
  ]);

  if (setlistsError || itemsError) {
    return { setlists: [] as Setlist[], favoriteIds: [] as string[], error: cloudError(setlistsError ?? itemsError) };
  }

  const rows = (setlistRows ?? []) as SetlistRow[];
  const itemsBySetlist = new Map<string, string[]>();

  for (const item of (itemRows ?? []) as SetlistItemRow[]) {
    const currentItems = itemsBySetlist.get(item.setlist_id) ?? [];
    currentItems.push(item.chart_id);
    itemsBySetlist.set(item.setlist_id, currentItems);
  }

  return {
    setlists: rows.map((row) => rowToSetlist(row, itemsBySetlist.get(row.id) ?? [])),
    favoriteIds: rows.filter((row) => row.is_favorite).map((row) => row.id),
    error: '',
  };
}

export async function fetchCloudSetlistById(id: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { setlist: null as Setlist | null, charts: [] as SavedChart[], error: 'Missing Supabase env vars.' };
  }

  if (!isUuid(id)) {
    return { setlist: null as Setlist | null, charts: [] as SavedChart[], error: 'Invalid setlist link.' };
  }

  const { data: setlistRow, error: setlistError } = await supabase.from('setlists').select('*').eq('id', id).single();

  if (setlistError) {
    return { setlist: null as Setlist | null, charts: [] as SavedChart[], error: cloudError(setlistError) };
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('setlist_items')
    .select('*')
    .eq('setlist_id', id)
    .order('position', { ascending: true });

  if (itemsError) {
    return { setlist: null as Setlist | null, charts: [] as SavedChart[], error: cloudError(itemsError) };
  }

  const songIds = ((itemRows ?? []) as SetlistItemRow[]).map((item) => item.chart_id);

  if (!songIds.length) {
    return { setlist: rowToSetlist(setlistRow as SetlistRow, []), charts: [] as SavedChart[], error: '' };
  }

  const { data: chartRows, error: chartsError } = await supabase.from('charts').select('*').in('id', songIds);

  if (chartsError) {
    return { setlist: null as Setlist | null, charts: [] as SavedChart[], error: cloudError(chartsError) };
  }

  const chartMap = new Map(((chartRows ?? []) as ChartRow[]).map((row) => [row.id, rowToChart(row)]));
  const orderedCharts = songIds.map((songId) => chartMap.get(songId)).filter((chart): chart is SavedChart => Boolean(chart));

  return {
    setlist: rowToSetlist(setlistRow as SetlistRow, songIds),
    charts: orderedCharts,
    error: '',
  };
}

export async function upsertCloudSetlist(setlist: Setlist, isFavorite = false, chartIdMap = new Map<string, string>()) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.', setlist: null as Setlist | null, skippedItems: 0 };
  }

  const row = setlistToRow(setlist, isFavorite);
  const query = isUuid(setlist.id)
    ? supabase.from('setlists').upsert(row, { onConflict: 'id' }).select('*').single()
    : supabase.from('setlists').insert(row).select('*').single();
  const { data, error: setlistError } = await query;

  if (setlistError) {
    return { ok: false, error: cloudError(setlistError), setlist: null as Setlist | null, skippedItems: 0 };
  }

  const cloudSetlist = rowToSetlist(data as SetlistRow, []);
  const mappedSongIds = setlist.songIds.map((songId) => chartIdMap.get(songId) ?? songId);
  const validSongIds = mappedSongIds.filter(isUuid);
  const skippedItems = mappedSongIds.length - validSongIds.length;

  const { error: deleteError } = await supabase.from('setlist_items').delete().eq('setlist_id', cloudSetlist.id);

  if (deleteError) {
    return { ok: false, error: cloudError(deleteError), setlist: null as Setlist | null, skippedItems };
  }

  if (!validSongIds.length) {
    return { ok: true, error: '', setlist: { ...cloudSetlist, songIds: mappedSongIds }, skippedItems };
  }

  const rows = validSongIds.map((chartId, index) => ({
    setlist_id: cloudSetlist.id,
    chart_id: chartId,
    position: index,
  }));
  const { error: itemsError } = await supabase.from('setlist_items').insert(rows);

  return itemsError
    ? { ok: false, error: cloudError(itemsError), setlist: null as Setlist | null, skippedItems }
    : { ok: true, error: '', setlist: { ...cloudSetlist, songIds: mappedSongIds }, skippedItems };
}

export async function upsertCloudSetlists(setlists: Setlist[], favoriteIds: string[], chartIdMap = new Map<string, string>()) {
  const idMap = new Map<string, string>();
  const uploadedSetlists: Setlist[] = [];
  let skippedItems = 0;
  const favoriteSet = new Set(favoriteIds);

  for (const setlist of setlists) {
    const result = await upsertCloudSetlist(setlist, favoriteSet.has(setlist.id), chartIdMap);

    if (!result.ok || !result.setlist) {
      return { ok: false, error: result.error, idMap, setlists: uploadedSetlists, skippedItems };
    }

    idMap.set(setlist.id, result.setlist.id);
    uploadedSetlists.push(result.setlist);
    skippedItems += result.skippedItems;
  }

  return { ok: true, error: '', idMap, setlists: uploadedSetlists, skippedItems };
}

export async function deleteCloudSetlist(id: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.' };
  }

  if (!isUuid(id)) {
    return { ok: true, error: '' };
  }

  const { error: itemsError } = await supabase.from('setlist_items').delete().eq('setlist_id', id);

  if (itemsError) {
    return { ok: false, error: cloudError(itemsError) };
  }

  const { error: setlistError } = await supabase.from('setlists').delete().eq('id', id);
  return setlistError ? { ok: false, error: cloudError(setlistError) } : { ok: true, error: '' };
}

export async function updateCloudSetlistFavorite(id: string, isFavorite: boolean) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: 'Missing Supabase env vars.' };
  }

  if (!isUuid(id)) {
    return { ok: true, error: '' };
  }

  const { error } = await supabase.from('setlists').update({ is_favorite: isFavorite }).eq('id', id);
  return error ? { ok: false, error: cloudError(error) } : { ok: true, error: '' };
}
