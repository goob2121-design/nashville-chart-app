import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const AUTH_COOKIE_NAME = 'pinnacle-chart-auth=true';

type HeartbeatRow = {
  app_name: string;
  id: string;
  last_ping: string | null;
  ping_count: number | null;
};

type HeartbeatUpsertRow = {
  app_name: string;
  last_ping: string;
  ping_count: number;
};

function rowToHeartbeat(row: HeartbeatRow) {
  return {
    appName: row.app_name,
    id: row.id,
    lastPing: row.last_ping ?? '',
    pingCount: row.ping_count ?? 0,
  };
}

function getHeartbeatStatus(lastPing: string) {
  if (!lastPing) {
    return 'No heartbeat yet';
  }

  const ageMs = Date.now() - new Date(lastPing).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 3.5) {
    return 'Healthy';
  }

  if (ageDays <= 7) {
    return 'Stale';
  }

  return 'Overdue';
}

function isCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') ?? '';

  return Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
}

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';

  if (isCronRequest(request)) {
    return true;
  }

  return cookie.includes(AUTH_COOKIE_NAME);
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type ServerSupabaseClient = NonNullable<ReturnType<typeof getServerSupabase>>;

async function loadHeartbeatRow(supabase: ServerSupabaseClient, appName: string) {
  const { data, error } = await supabase.from('app_heartbeat').select('*').eq('app_name', appName).maybeSingle();
  return { data: data as HeartbeatRow | null, error };
}

async function upsertHeartbeatRow(supabase: ServerSupabaseClient, appName: string) {
  const { data: existingData, error: existingError } = await loadHeartbeatRow(supabase, appName);

  if (existingError) {
    return { heartbeat: null as ReturnType<typeof rowToHeartbeat> | null, error: existingError.message };
  }

  const nextPingCount = (existingData?.ping_count ?? 0) + 1;
  const payload: HeartbeatUpsertRow = {
    app_name: appName,
    last_ping: new Date().toISOString(),
    ping_count: nextPingCount,
  };
  const { data, error } = await supabase
    .from('app_heartbeat')
    .upsert(payload as never, { onConflict: 'app_name' })
    .select('*')
    .single();

  if (error) {
    return { heartbeat: null as ReturnType<typeof rowToHeartbeat> | null, error: error.message };
  }

  const heartbeat = rowToHeartbeat(data as HeartbeatRow);
  console.info('[supabase-heartbeat] Ping successful', {
    appName,
    lastPing: heartbeat.lastPing,
    pingCount: heartbeat.pingCount,
  });

  return { heartbeat, error: '' };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized', heartbeat: null, status: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  if (!supabase) {
    return Response.json({ error: 'Missing Supabase server env vars.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const appName = searchParams.get('appName') || 'chart-app';
  if (isCronRequest(request)) {
    const cronResult = await upsertHeartbeatRow(supabase, appName);

    if (cronResult.error || !cronResult.heartbeat) {
      console.error('[supabase-heartbeat] Cron GET failed', { appName, error: cronResult.error });
      return Response.json({ error: cronResult.error || 'Heartbeat update failed.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
    }

    return Response.json({
      error: '',
      heartbeat: cronResult.heartbeat,
      status: getHeartbeatStatus(cronResult.heartbeat.lastPing),
    });
  }

  const { data, error } = await loadHeartbeatRow(supabase, appName);

  if (error) {
    console.error('[supabase-heartbeat] GET failed', { appName, error: error.message });
    return Response.json({ error: error.message, heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const heartbeat = data ? rowToHeartbeat(data as HeartbeatRow) : null;
  return Response.json({ error: '', heartbeat, status: heartbeat ? getHeartbeatStatus(heartbeat.lastPing) : 'No heartbeat yet' });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized', heartbeat: null, status: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  if (!supabase) {
    return Response.json({ error: 'Missing Supabase server env vars.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { appName?: string };
  const appName = body.appName?.trim() || 'chart-app';
  const result = await upsertHeartbeatRow(supabase, appName);

  if (result.error || !result.heartbeat) {
    console.error('[supabase-heartbeat] POST failed', { appName, error: result.error });
    return Response.json({ error: result.error || 'Heartbeat update failed.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const heartbeat = result.heartbeat;
  return Response.json({ error: '', heartbeat, status: getHeartbeatStatus(heartbeat.lastPing) });
}
