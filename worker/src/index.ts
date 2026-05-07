import type { Env, StravaActivity, SyncMetadata } from "./types.js";
import { fetchAllNewActivities, refreshTokenIfNeeded } from "./strava.js";

async function syncActivities(env: Env): Promise<string> {
  const accessToken = await refreshTokenIfNeeded(env);

  const metadata = await env.STRAVA_KV.get<SyncMetadata>(
    "sync_metadata",
    "json",
  );
  const after = metadata?.last_activity_date
    ? Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
    : 0;

  const newActivities = await fetchAllNewActivities(accessToken, after);

  if (newActivities.length === 0) {
    return "No new activities";
  }

  const existing =
    (await env.STRAVA_KV.get<StravaActivity[]>("activities", "json")) || [];

  const newIds = new Set(newActivities.map((a) => a.id));
  const merged = [
    ...newActivities,
    ...existing.filter((a) => !newIds.has(a.id)),
  ].sort(
    (a, b) =>
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );

  const updatedMetadata: SyncMetadata = {
    last_sync: new Date().toISOString(),
    last_activity_date: merged[0].start_date,
    total_activities: merged.length,
  };

  await env.STRAVA_KV.put("activities", JSON.stringify(merged));
  await env.STRAVA_KV.put("sync_metadata", JSON.stringify(updatedMetadata));

  const hookRes = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
  if (!hookRes.ok) {
    console.error(`Deploy hook failed: ${hookRes.status} ${hookRes.statusText}`);
  }

  return `Synced ${newActivities.length} new activities (${merged.length} total)`;
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
  ): Promise<void> {
    await syncActivities(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${env.WORKER_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await syncActivities(env);
    return new Response(result, { status: 200 });
  },
};
