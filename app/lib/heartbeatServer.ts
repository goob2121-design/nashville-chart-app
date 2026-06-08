import { createClient } from '@supabase/supabase-js';

const AUTH_COOKIE_NAME = 'pinnacle-chart-auth=true';

type HeartbeatRow = {
  app_name: string;
  id: string;
  last_source?: string | null;
  last_ping: string | null;
  ping_count: number | null;
};

type HeartbeatUpsertRow = {
  app_name: string;
  last_source?: 'manual' | 'cron';
  last_ping: string;
  ping_count: number;
};

export function rowToHeartbeat(row: HeartbeatRow) {
  return {
    appName: row.app_name,
    id: row.id,
    lastPing: row.last_ping ?? '',
    lastSource: row.last_source === 'manual' || row.last_source === 'cron' ? row.last_source : '',
    pingCount: row.ping_count ?? 0,
  };
}

export function getHeartbeatStatus(lastPing: string) {
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

export function isManualHeartbeatAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.includes(AUTH_COOKIE_NAME);
}

export function isCronHeartbeatAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') ?? '';
  return Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
}

export function getServerSupabase() {
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

export async function loadHeartbeatRow(supabase: ServerSupabaseClient, appName: string) {
  const { data, error } = await supabase.from('app_heartbeat').select('*').eq('app_name', appName).maybeSingle();
  return { data: data as HeartbeatRow | null, error };
}

export async function upsertHeartbeatRow(supabase: ServerSupabaseClient, appName: string, source: 'manual' | 'cron') {
  const { data: existingData, error: existingError } = await loadHeartbeatRow(supabase, appName);

  if (existingError) {
    return { heartbeat: null as ReturnType<typeof rowToHeartbeat> | null, error: existingError.message };
  }

  const nextPingCount = (existingData?.ping_count ?? 0) + 1;
  const payload: HeartbeatUpsertRow = {
    app_name: appName,
    last_source: source,
    last_ping: new Date().toISOString(),
    ping_count: nextPingCount,
  };
  let { data, error } = await supabase
    .from('app_heartbeat')
    .upsert(payload as never, { onConflict: 'app_name' })
    .select('*')
    .single();

  if (error?.message?.toLowerCase().includes('last_source')) {
    const fallbackPayload = {
      app_name: appName,
      last_ping: payload.last_ping,
      ping_count: payload.ping_count,
    };

    ({ data, error } = await supabase
      .from('app_heartbeat')
      .upsert(fallbackPayload as never, { onConflict: 'app_name' })
      .select('*')
      .single());
  }

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
