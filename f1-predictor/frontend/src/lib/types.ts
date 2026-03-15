export interface DriverPrediction {
  position: number;
  driver_name: string;
  driver_code: string;
  team: string;
  team_color: string;
  driver_number: number;
  win_probability: number;
  podium_probability: number;
  predicted_finish: number;
  confidence: "high" | "medium" | "low";
  key_factors: string[];
  quali_position: number;
}

export interface RacePrediction {
  race: string;
  round: number;
  circuit: string;
  circuit_type: string;
  predicted_at: string;
  data_freshness: "pre-weekend" | "post-fp" | "post-qualifying" | "race-day";
  model_accuracy_ytd: number;
  model_source: string;
  predictions: DriverPrediction[];
  race_date: string;
  season: number;
}

export interface PodiumEntry {
  driver_code: string;
  driver_name: string;
  team: string;
  team_color: string;
  win_probability?: number;
  podium_probability?: number;
}

export interface RaceResult {
  round: number;
  race: string;
  circuit: string;
  race_date: string;
  predicted_winner: string;
  actual_winner: string;
  correct_win: boolean;
  predicted_podium: string[];
  actual_podium: string[];
  podium_hits: number;
  predicted_top3?: PodiumEntry[];
  actual_top3?: PodiumEntry[];
  updated_at: string;
}

export interface HistoryData {
  results: RaceResult[];
  season_winner_accuracy: number | null;
  season_podium_accuracy: number | null;
}

export interface CalendarRace {
  round: number;
  name: string;
  circuit: string;
  country: string;
  locality: string;
  date: string;
  race_datetime: string;
}

export interface CalendarData {
  season: number;
  races: CalendarRace[];
}
