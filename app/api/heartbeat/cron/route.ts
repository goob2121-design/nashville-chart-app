import {
  getHeartbeatStatus,
  getServerSupabase,
  isCronHeartbeatAuthorized,
  upsertHeartbeatRow,
} from '../../../lib/heartbeatServer';

export const dynamic = 'force-dynamic';

async function handleCronPing(request: Request) {
  if (!isCronHeartbeatAuthorized(request)) {
    return Response.json({ error: 'Unauthorized', heartbeat: null, status: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  if (!supabase) {
    return Response.json({ error: 'Missing Supabase server env vars.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  const appName = new URL(request.url).searchParams.get('appName') || 'chart-app';
  const result = await upsertHeartbeatRow(supabase, appName, 'cron');

  if (result.error || !result.heartbeat) {
    console.error('[supabase-heartbeat-cron] Ping failed', { appName, error: result.error });
    return Response.json({ error: result.error || 'Heartbeat update failed.', heartbeat: null, status: 'Unavailable' }, { status: 500 });
  }

  return Response.json({
    error: '',
    heartbeat: result.heartbeat,
    status: getHeartbeatStatus(result.heartbeat.lastPing),
  });
}

export async function GET(request: Request) {
  return handleCronPing(request);
}

export async function POST(request: Request) {
  return handleCronPing(request);
}
