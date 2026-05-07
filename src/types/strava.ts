export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  kudos_count: number;
}

export interface ActivitySummary {
  date: string;
  type: string;
  moving_time: number;
  distance: number;
}

export interface DaySummary {
  date: string;
  type: string;
  moving_time: number;
  count: number;
  secondaries?: { type: string; moving_time: number }[];
}

export interface YearSummary {
  year: number;
  total_distance_km: number;
  total_activities: number;
  total_moving_time_seconds: number;
  active_days: number;
  pct_of_year: number;
  avg_weekly_distance_km: number;
  avg_weekly_moving_time_seconds: number;
  categories: CategoryStats[];
}

export interface CategoryStats {
  key: string;
  label: string;
  color: string;
  count: number;
  active_days: number;
  pct_of_year: number;
  distance_km: number;
  moving_time_seconds: number;
  avg_weekly_distance_km: number;
  avg_weekly_moving_time_seconds: number;
}

export interface StravaPageData {
  activities: ActivitySummary[];
  years: YearSummary[];
}
