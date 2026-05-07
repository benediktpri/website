import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  StravaActivity,
  ActivitySummary,
  CategoryStats,
  YearSummary,
  StravaPageData,
} from "../src/types/strava.js";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const CYCLING_TYPES = new Set(["Ride", "VirtualRide", "MountainBikeRide"]);
const STRENGTH_TYPES = new Set(["Workout", "WeightTraining"]);

const CATEGORY_CONFIG: {
  key: string;
  label: string;
  color: string;
  types: Set<string>;
}[] = [
  { key: "running", label: "Run", color: "#70CF25", types: RUN_TYPES },
  { key: "cycling", label: "Ride", color: "#FC5200", types: CYCLING_TYPES },
  {
    key: "strength",
    label: "Workout",
    color: "#997700",
    types: STRENGTH_TYPES,
  },
];

function getCategoryKey(sportType: string): string {
  for (const cat of CATEGORY_CONFIG) {
    if (cat.types.has(sportType)) return cat.key;
  }
  return "other";
}

function getWeeksForYear(year: number): number {
  const now = new Date();
  if (year < now.getFullYear()) return 52;
  const start = new Date(year, 0, 1);
  const diffDays = Math.floor(
    (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(1, Math.floor(diffDays / 7));
}

const CF_ACCOUNT_ID = process.env.KV_ACCOUNT_ID;
const CF_KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID;
const CF_API_TOKEN = process.env.KV_API_TOKEN;

const OUTPUT_PATH = resolve(import.meta.dirname, "../src/data/strava.json");

const EMPTY_DATA: StravaPageData = { activities: [], years: [] };

async function fetchKVKey(key: string): Promise<string | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${key}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  if (!response.ok) return null;
  return response.text();
}

function extractActivities(activities: StravaActivity[]): ActivitySummary[] {
  return activities
    .map((a) => ({
      date: a.start_date.slice(0, 10),
      type: a.sport_type,
      moving_time: a.moving_time,
      distance: a.distance,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateYears(activities: StravaActivity[]): YearSummary[] {
  const byYear = new Map<number, StravaActivity[]>();

  for (const activity of activities) {
    const year = new Date(activity.start_date).getFullYear();
    const existing = byYear.get(year) || [];
    existing.push(activity);
    byYear.set(year, existing);
  }

  const years: YearSummary[] = [];
  for (const [year, yearActivities] of byYear) {
    const weeks = getWeeksForYear(year);
    const now = new Date();
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInYear = isLeapYear ? 366 : 365;
    const daysSoFar =
      year < now.getFullYear()
        ? daysInYear
        : Math.floor(
            (now.getTime() - new Date(year, 0, 1).getTime()) /
              (24 * 60 * 60 * 1000),
          ) + 1;

    const totalDistance = yearActivities.reduce(
      (sum, a) => sum + a.distance,
      0,
    );
    const totalMovingTime = yearActivities.reduce(
      (sum, a) => sum + a.moving_time,
      0,
    );

    const allDates = new Set(
      yearActivities.map((a) => a.start_date.slice(0, 10)),
    );

    const catMap = new Map<
      string,
      { count: number; days: Set<string>; distance: number; time: number }
    >();
    for (const cat of [
      ...CATEGORY_CONFIG,
      {
        key: "other",
        label: "Other",
        color: "#44403c",
        types: new Set<string>(),
      },
    ]) {
      catMap.set(cat.key, { count: 0, days: new Set(), distance: 0, time: 0 });
    }

    for (const a of yearActivities) {
      const key = getCategoryKey(a.sport_type);
      const entry = catMap.get(key)!;
      entry.count++;
      entry.days.add(a.start_date.slice(0, 10));
      entry.distance += a.distance;
      entry.time += a.moving_time;
    }

    const allConfigs = [
      ...CATEGORY_CONFIG,
      {
        key: "other",
        label: "Other",
        color: "#44403c",
        types: new Set<string>(),
      },
    ];

    const categories: CategoryStats[] = allConfigs.map((cat) => {
      const entry = catMap.get(cat.key)!;
      const distKm = Math.round((entry.distance / 1000) * 10) / 10;
      return {
        key: cat.key,
        label: cat.label,
        color: cat.color,
        count: entry.count,
        active_days: entry.days.size,
        pct_of_year: Math.round((entry.days.size / daysSoFar) * 100),
        distance_km: distKm,
        moving_time_seconds: entry.time,
        avg_weekly_distance_km: Math.round((distKm / weeks) * 10) / 10,
        avg_weekly_moving_time_seconds: Math.round(entry.time / weeks),
      };
    });

    const totalDistanceKm = Math.round((totalDistance / 1000) * 10) / 10;

    years.push({
      year,
      total_distance_km: totalDistanceKm,
      total_activities: yearActivities.length,
      total_moving_time_seconds: totalMovingTime,
      active_days: allDates.size,
      pct_of_year: Math.round((allDates.size / daysSoFar) * 100),
      avg_weekly_distance_km: Math.round((totalDistanceKm / weeks) * 10) / 10,
      avg_weekly_moving_time_seconds: Math.round(totalMovingTime / weeks),
      categories,
    });
  }

  return years.sort((a, b) => b.year - a.year);
}

async function main() {
  if (!CF_ACCOUNT_ID || !CF_KV_NAMESPACE_ID || !CF_API_TOKEN) {
    if (existsSync(OUTPUT_PATH)) {
      console.warn("Missing CF env vars — keeping existing strava.json");
    } else {
      console.warn(
        "Missing CF env vars and no strava.json — writing empty data",
      );
      writeFileSync(OUTPUT_PATH, JSON.stringify(EMPTY_DATA, null, 2));
    }
    return;
  }

  const raw = await fetchKVKey("activities");
  if (!raw) {
    console.warn("No activities in KV — writing empty data");
    writeFileSync(OUTPUT_PATH, JSON.stringify(EMPTY_DATA, null, 2));
    return;
  }

  const activities: StravaActivity[] = JSON.parse(raw);
  const data: StravaPageData = {
    activities: extractActivities(activities),
    years: aggregateYears(activities),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(
    `Wrote ${data.activities.length} activities, ${data.years.length} years to ${OUTPUT_PATH}`,
  );
}

main().catch((err) => {
  console.error("Prebuild failed:", err);
  process.exit(1);
});
