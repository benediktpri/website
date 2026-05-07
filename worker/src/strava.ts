import type { Env, StravaActivity, StravaTokens } from "./types.js";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL =
  "https://www.strava.com/api/v3/athlete/activities";

const ACTIVITY_FIELDS: (keyof StravaActivity)[] = [
  "id",
  "name",
  "type",
  "sport_type",
  "distance",
  "moving_time",
  "elapsed_time",
  "total_elevation_gain",
  "start_date",
  "average_speed",
  "max_speed",
  "average_heartrate",
  "max_heartrate",
  "suffer_score",
  "kudos_count",
];

const OPTIONAL_FIELDS: Set<keyof StravaActivity> = new Set([
  "average_heartrate",
  "max_heartrate",
  "suffer_score",
]);

export function stripActivity(raw: Record<string, unknown>): StravaActivity {
  const activity: Record<string, unknown> = {};
  for (const field of ACTIVITY_FIELDS) {
    if (raw[field] == null) {
      if (!OPTIONAL_FIELDS.has(field)) {
        throw new Error(
          `Activity ${raw.id ?? "unknown"} missing field: ${field}`,
        );
      }
      continue;
    }
    activity[field] = raw[field];
  }
  return activity as unknown as StravaActivity;
}

export async function refreshTokenIfNeeded(env: Env): Promise<string> {
  const stored = await env.STRAVA_KV.get<StravaTokens>("strava_tokens", "json");
  if (!stored) {
    throw new Error("No stored tokens in KV");
  }

  const now = Math.floor(Date.now() / 1000);
  if (stored.expires_at > now + 300) {
    return stored.access_token;
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  const updated: StravaTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };

  await env.STRAVA_KV.put("strava_tokens", JSON.stringify(updated));
  return updated.access_token;
}

async function fetchActivitiesPage(
  accessToken: string,
  after: number,
  page: number,
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    after: String(after),
    page: String(page),
    per_page: "200",
  });

  const response = await fetch(`${STRAVA_ACTIVITIES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava API error: ${response.status} ${body}`);
  }

  const raw = (await response.json()) as Record<string, unknown>[];
  return raw.map(stripActivity);
}

export async function fetchAllNewActivities(
  accessToken: string,
  after: number,
): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  let page = 1;

  while (true) {
    const batch = await fetchActivitiesPage(accessToken, after, page);
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 200) break;
    page++;
  }

  return all;
}
