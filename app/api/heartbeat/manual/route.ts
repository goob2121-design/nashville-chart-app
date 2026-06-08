import {
  getHeartbeatStatus,
  getServerSupabase,
  isManualHeartbeatAuthorized,
  loadHeartbeatRow,
  upsertHeartbeatRow,
} from '../../../lib/heartbeatServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isManualHeartbeatAuthorized(request)) {
    return Response.json({ error: 'Unauthorized', heartbeat: null, status: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  if (!supabase) {
    return Response.json({ error: 'Missing Supabase server env vars.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const appName = searchParams.get('appName') || 'chart-app';
  const { data, error } = await loadHeartbeatRow(supabase, appName);

  if (error) {
    console.error('[supabase-heartbeat-manual] GET failed', { appName, error: error.message });
    return Response.json({ error: error.message, heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const heartbeat = data ? {
    appName: data.app_name,
    id: data.id,
    lastPing: data.last_ping ?? '',
    pingCount: data.ping_count ?? 0,
  } : null;

  return Response.json({
    error: '',
    heartbeat,
    status: heartbeat ? getHeartbeatStatus(heartbeat.lastPing) : 'No heartbeat yet',
  });
}

export async function POST(request: Request) {
  if (!isManualHeartbeatAuthorized(request)) {
    return Response.json({ error: 'Unauthorized', heartbeat: null, status: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  if (!supabase) {
    return Response.json({ error: 'Missing Supabase server env vars.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { appName?: string };
  const appName = body.appName?.trim() || 'chart-app';
  const result = await upsertHeartbeatRow(supabase, appName, 'manual');

  if (result.error || !result.heartbeat) {
    console.error('[supabase-heartbeat-manual] POST failed', { appName, error: result.error });
    return Response.json({ error: result.error || 'Heartbeat update failed.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  return Response.json({
    error: '',
    heartbeat: result.heartbeat,
    status: getHeartbeatStatus(result.heartbeat.lastPing),
  });
}
