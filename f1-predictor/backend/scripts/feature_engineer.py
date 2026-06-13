"""
Build feature matrix for model training and inference.
Each row = one driver in one race, with all predictive features.
"""

from __future__ import annotations
from pathlib import Path

import numpy as np
import pandas as pd

from collect_data import (
    get_race_results,
    get_qualifying_results,
    get_sprint_results,
    get_constructor_standings,
    get_driver_standings,
    get_fp_pace,
    get_fp2_long_run_pace,
    get_race_weather,
)
from utils import season_weight, DRIVERS_2026, get_circuit_type, get_overtake_difficulty

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

HISTORY_SEASONS = [2023, 2024, 2025, 2026]  # 2026 included: new reg era, but real ground truth outweighs noise


def _sprint_pace_df(year: int, round_num: int) -> pd.DataFrame:
    """
    Build a pace-delta DataFrame from sprint fastest laps, in the same format
    as get_fp_pace() output (columns: driverCode, fp_pace_delta_pct).
    Used as fallback on sprint weekends where FP2/FP3 don't exist.
    """
    try:
        sprint = get_sprint_results(year, round_num)
        if sprint.empty or "fastest_lap_time" not in sprint.columns:
            return pd.DataFrame()
        sprint = sprint.dropna(subset=["fastest_lap_time"]).copy()
        if sprint.empty:
            return pd.DataFrame()
        sprint["lap_seconds"] = sprint["fastest_lap_time"].apply(_time_str_to_seconds)
        sprint = sprint.dropna(subset=["lap_seconds"])
        if sprint.empty:
            return pd.DataFrame()
        fastest = sprint["lap_seconds"].min()
        sprint["fp_pace_delta_pct"] = (sprint["lap_seconds"] - fastest) / fastest * 100
        return sprint[["driverCode", "fp_pace_delta_pct"]].reset_index(drop=True)
    except Exception:
        return pd.DataFrame()


def _time_str_to_seconds(t: str | None) -> float | None:
    """Parse lap time string '1:40.331' → seconds."""
    if not t or not isinstance(t, str):
        return None
    try:
        parts = t.split(":")
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return float(t)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Build historical feature dataset (training)
# ---------------------------------------------------------------------------

def build_training_dataset(seasons: list[int] = HISTORY_SEASONS) -> pd.DataFrame:
    """
    Build full feature + label DataFrame across multiple seasons.
    Label = finishing_position (and derived: win, podium).
    """
    from collect_data import get_race_calendar

    # Load ALL results across all seasons first so each race can use
    # cross-season form data (e.g. 2024 R1 sees full 2023 history).
    print("Loading all historical results...")
    all_results_frames: list[pd.DataFrame] = []
    calendars: dict[int, list[dict]] = {}
    for year in seasons:
        try:
            cal = get_race_calendar(year)
        except Exception:
            cal = []
        calendars[year] = cal
        for race in cal:
            try:
                r = get_race_results(year, race["round"])
                if not r.empty:
                    r["circuit"] = race.get("circuit", "")
                    all_results_frames.append(r)
            except Exception:
                pass

    if not all_results_frames:
        return pd.DataFrame()

    all_results = pd.concat(all_results_frames, ignore_index=True)

    all_rows: list[pd.DataFrame] = []
    for year in seasons:
        print(f"Building features for {year}...")
        for race in calendars.get(year, []):
            rn = race["round"]
            try:
                row_df = _build_race_features(year, rn, all_results, race)
                if row_df is not None and not row_df.empty:
                    all_rows.append(row_df)
            except Exception as exc:
                print(f"  Skipping {year} R{rn}: {exc}")

    if not all_rows:
        return pd.DataFrame()
    return pd.concat(all_rows, ignore_index=True)


def _build_race_features(
    year: int,
    round_num: int,
    all_results: pd.DataFrame,
    race_meta: dict,
) -> pd.DataFrame | None:
    """Build feature rows for all drivers in a single race."""
    # Results for this race (labels)
    race_results = all_results[(all_results["season"] == year) & (all_results["round"] == round_num)].copy()
    if race_results.empty:
        return None

    # Qualifying
    try:
        quali = get_qualifying_results(year, round_num)
    except Exception:
        quali = pd.DataFrame()

    # Past results (only races before this one to avoid leakage)
    past_results = all_results[
        (all_results["season"] < year) |
        ((all_results["season"] == year) & (all_results["round"] < round_num))
    ]

    # FP pace: FP2 long runs (race representative) → FP3 best lap → FP2 best lap → FP1 → sprint
    fp_pace = pd.DataFrame()
    try:
        fp_pace = get_fp2_long_run_pace(year, round_num)
    except Exception:
        pass
    if fp_pace.empty:
        for session in ("Practice 3", "Practice 2", "Practice 1"):
            try:
                fp_pace = get_fp_pace(year, round_num, session)
                if not fp_pace.empty:
                    break
            except Exception:
                pass
    if fp_pace.empty:
        fp_pace = _sprint_pace_df(year, round_num)

    # Sprint finishing positions (empty DataFrame for non-sprint weekends)
    sprint_results = pd.DataFrame()
    try:
        sprint_results = get_sprint_results(year, round_num)
    except Exception:
        pass

    # Driver + constructor standings: use previous round to avoid leakage.
    # For round 1, use end of prior season standings.
    try:
        if round_num == 1:
            standings = get_driver_standings(year - 1)
            con_standings = get_constructor_standings(year - 1)
        else:
            standings = get_driver_standings(year, round_num - 1)
            con_standings = get_constructor_standings(year, round_num - 1)
    except Exception:
        standings = pd.DataFrame()
        con_standings = pd.DataFrame()

    # Race weather (fetched once, applied to all drivers)
    try:
        weather_dict = get_race_weather(
            year, round_num,
            race_date=race_meta.get("date"),
            lat=float(race_meta["lat"]) if race_meta.get("lat") else None,
            lon=float(race_meta["lon"]) if race_meta.get("lon") else None,
            race_datetime_utc=race_meta.get("race_datetime"),
        )
    except Exception:
        weather_dict = {"is_raining": 0, "track_temp_celsius": 30.0}

    rows = []
    for _, race_row in race_results.iterrows():
        code = race_row["driverCode"]
        feats = _driver_features(
            driver_code=code,
            year=year,
            round_num=round_num,
            race_meta=race_meta,
            past_results=past_results,
            quali_df=quali,
            fp_pace_df=fp_pace,
            standings_df=standings,
            con_standings_df=con_standings,
            weather_dict=weather_dict,
            sprint_df=sprint_results,
        )
        feats["season"] = year
        feats["round"] = round_num
        feats["race_name"] = race_meta.get("name", "")
        feats["circuit"] = race_meta.get("circuit", "")
        # Labels
        feats["finishing_position"] = int(race_row["position"])
        feats["win"] = int(race_row["position"] == 1)
        feats["podium"] = int(race_row["position"] <= 3)
        feats["sample_weight"] = season_weight(year)
        rows.append(feats)

    return pd.DataFrame(rows) if rows else None


def _driver_features(
    driver_code: str,
    year: int,
    round_num: int,
    race_meta: dict,
    past_results: pd.DataFrame,
    quali_df: pd.DataFrame,
    fp_pace_df: pd.DataFrame,
    standings_df: pd.DataFrame = pd.DataFrame(),
    con_standings_df: pd.DataFrame = pd.DataFrame(),
    weather_dict: dict | None = None,
    sprint_df: pd.DataFrame = pd.DataFrame(),
) -> dict:
    """Compute all features for a single driver in a single race."""
    feats: dict = {"driverCode": driver_code}
    if weather_dict is None:
        weather_dict = {"is_raining": 0, "track_temp_celsius": 30.0}

    # DNS / DSQ events are not race-pace data — strip them before computing any form metric.
    # "Did not start" and "Disqualified" distort averages, DNF rates, and positions-gained
    # the same way a retirement does, but without any pace signal at all.
    _NON_RACE = {"Did not start", "Did not qualify", "Disqualified", "Withdrew", "Excluded"}

    # ---- Qualifying features ----
    # Fallback: driver's average grid position from recent races (much better than flat P15)
    driver_past_for_quali = past_results[past_results["driverCode"] == driver_code]
    if not driver_past_for_quali.empty and "grid" in driver_past_for_quali.columns:
        avg_grid = float(driver_past_for_quali.tail(10)["grid"].replace(0, pd.NA).dropna().mean())
        quali_fallback = int(round(avg_grid)) if not pd.isna(avg_grid) else 15
    else:
        quali_fallback = 15

    if not quali_df.empty and "driverCode" in quali_df.columns:
        dq = quali_df[quali_df["driverCode"] == driver_code]
        if not dq.empty:
            feats["quali_position"] = int(dq.iloc[0]["quali_position"])
        else:
            # Qualifying happened but driver not listed → crashed/excluded → last place
            feats["quali_position"] = int(len(quali_df)) + 1
    else:
        feats["quali_position"] = quali_fallback

    # Qualifying gap to pole (percentage)
    if not quali_df.empty and "best_time" in quali_df.columns:
        times = _parse_quali_times(quali_df)
        if times and driver_code in times and times[driver_code] is not None:
            pole_time = min(v for v in times.values() if v is not None)
            driver_time = times[driver_code]
            feats["quali_gap_to_pole_pct"] = (driver_time - pole_time) / pole_time * 100
        else:
            # Driver in quali but no time set (e.g. Q3 crash before completing a lap).
            # FP3 pace is a much better proxy than a coarse positional estimate.
            if not fp_pace_df.empty and driver_code in fp_pace_df["driverCode"].values:
                fp_row = fp_pace_df[fp_pace_df["driverCode"] == driver_code].iloc[0]
                feats["quali_gap_to_pole_pct"] = float(fp_row["fp_pace_delta_pct"])
            else:
                field_size = max(len(quali_df), 20)
                feats["quali_gap_to_pole_pct"] = (feats["quali_position"] - 1) / field_size * 3.0
    else:
        field_size = 20
        feats["quali_gap_to_pole_pct"] = (feats["quali_position"] - 1) / field_size * 3.0

    # ---- Recent form (last 5 races) ----
    driver_past = past_results[past_results["driverCode"] == driver_code].copy()
    # Strip DNS/DSQ before any form computation — these aren't race-pace events
    if "status" in driver_past.columns:
        driver_past = driver_past[~driver_past["status"].isin(_NON_RACE)]
    if not driver_past.empty:
        last5 = driver_past.sort_values(["season", "round"]).tail(5)
        feats["recent_form_5"] = float(last5["position"].mean()) if len(last5) > 0 else 10.0
        last10 = driver_past.sort_values(["season", "round"]).tail(10)
        dnf_mask = ~last10["status"].str.lower().str.contains("finish", na=False)
        feats["dnf_rate_10"] = float(dnf_mask.mean())

        # Average positions gained from grid to finish (positive = charges forward)
        if "grid" in last5.columns:
            gains = last5["grid"] - last5["position"]
            feats["positions_gained_avg"] = float(gains.mean())
        else:
            feats["positions_gained_avg"] = 0.0

        # Career win rate and podium rate — captures all-time ability regardless of team switch
        total_starts = len(driver_past)
        feats["career_win_rate"] = float((driver_past["position"] == 1).sum() / total_starts)
        feats["career_podium_rate"] = float((driver_past["position"] <= 3).sum() / total_starts)

        # Recent season form: avg position in most recent complete season only.
        # Better reflects current car performance than multi-year career stats.
        max_season = int(driver_past["season"].max())
        recent_season = driver_past[driver_past["season"] == max_season]
        feats["recent_season_avg_pos"] = float(recent_season["position"].mean()) if not recent_season.empty else feats["recent_form_5"]
    else:
        feats["recent_form_5"] = 10.0
        feats["dnf_rate_10"] = 0.1
        feats["positions_gained_avg"] = 0.0
        feats["career_win_rate"] = 0.0
        feats["career_podium_rate"] = 0.0
        feats["recent_season_avg_pos"] = 10.0

    # ---- Circuit historical average + safety car proxy ----
    circuit = race_meta.get("circuit", "")
    circuit_past = driver_past[driver_past.get("circuit", pd.Series(dtype=str)) == circuit] if "circuit" in driver_past.columns else pd.DataFrame()
    if not circuit_past.empty:
        # Exclude retirements — DNFs reflect reliability not pace and distort the mean.
        circuit_classified = circuit_past[circuit_past["status"] != "Retired"] if "status" in circuit_past.columns else circuit_past
        # Prefer current-team results so a driver's record with a previous team
        # (different car/era) doesn't inflate or deflate their circuit average.
        current_constructor = (
            driver_past.sort_values(["season", "round"]).iloc[-1]["constructorId"]
            if not driver_past.empty and "constructorId" in driver_past.columns
            else None
        )
        circuit_same_team = (
            circuit_classified[circuit_classified["constructorId"] == current_constructor]
            if current_constructor is not None and "constructorId" in circuit_classified.columns
            else pd.DataFrame()
        )
        circuit_rows = (
            circuit_same_team if not circuit_same_team.empty
            else circuit_classified if not circuit_classified.empty
            else pd.DataFrame()
        )
        if not circuit_rows.empty:
            sorted_rows = circuit_rows.sort_values(["season", "round"])
            n = len(sorted_rows)
            weights = np.exp(np.linspace(0, 2, n))
            feats["circuit_hist_avg"] = float(np.average(sorted_rows["position"], weights=weights))
            # Positions gained at this circuit specifically (grid - finish, positive = moved forward).
            # Separates "finishes well here" from "starts well here" — critical at Monaco-type tracks
            # where circuit_hist_avg is almost entirely determined by qualifying position.
            if "grid" in sorted_rows.columns:
                valid_grid = sorted_rows[sorted_rows["grid"] > 0]
                if not valid_grid.empty:
                    g_weights = np.exp(np.linspace(0, 2, len(valid_grid)))
                    deltas = valid_grid["grid"] - valid_grid["position"]
                    feats["circuit_positions_gained_avg"] = float(np.average(deltas, weights=g_weights))
                else:
                    feats["circuit_positions_gained_avg"] = 0.0
            else:
                feats["circuit_positions_gained_avg"] = 0.0
        else:
            feats["circuit_hist_avg"] = feats["recent_form_5"]
            feats["circuit_positions_gained_avg"] = 0.0
    else:
        feats["circuit_hist_avg"] = feats["recent_form_5"]  # fallback
        feats["circuit_positions_gained_avg"] = 0.0

    # Safety car probability proxy: at chaotic circuits, grid position predicts
    # finish position less well. Measure as mean abs(grid - finish) across all
    # drivers in historical races at this circuit. Higher = more chaos / SC likely.
    if not past_results.empty and "circuit" in past_results.columns and "grid" in past_results.columns:
        circuit_all = past_results[past_results["circuit"] == circuit]
        if not circuit_all.empty:
            valid = circuit_all[(circuit_all["grid"] > 0) & (circuit_all["position"] > 0)]
            feats["circuit_chaos_rate"] = float((valid["grid"] - valid["position"]).abs().mean()) if not valid.empty else 3.0
        else:
            feats["circuit_chaos_rate"] = 3.0
    else:
        feats["circuit_chaos_rate"] = 3.0

    # ---- Constructor reliability (this season) ----
    constructor_id = None
    if not past_results.empty and driver_code in past_results["driverCode"].values:
        constructor_id = past_results[past_results["driverCode"] == driver_code]["constructorId"].iloc[-1]

    if constructor_id and not past_results.empty:
        team_past = past_results[
            (past_results["constructorId"] == constructor_id) &
            (past_results["season"] == year)
        ]
        if not team_past.empty:
            # Exclude DNS/DSQ — these are not reliability failures, they're pre-race events
            team_started = team_past[~team_past["status"].isin(_NON_RACE)] if "status" in team_past.columns else team_past
            if not team_started.empty:
                dnf_mask_team = ~team_started["status"].str.lower().str.contains("finish", na=False)
                feats["team_reliability_score"] = float(1 - dnf_mask_team.mean())
            else:
                feats["team_reliability_score"] = 0.9
        else:
            feats["team_reliability_score"] = 0.9

        # Team race pace rank: exponentially weighted recent races (more weight to recent).
        # Exclude DNS/DSQ — those aren't race-pace data and inflate the rank badly.
        team_recent = past_results[past_results["constructorId"] == constructor_id].copy()
        if "status" in team_recent.columns:
            team_recent = team_recent[~team_recent["status"].isin(_NON_RACE)]
        team_recent = team_recent.sort_values(["season", "round"]).tail(20)
        if not team_recent.empty:
            weights = np.exp(np.linspace(0, 1, len(team_recent)))
            feats["team_race_pace_rank"] = float(np.average(team_recent["position"], weights=weights))
        else:
            feats["team_race_pace_rank"] = 10.0

        # Teammate head-to-head: driver's avg finish vs teammate's avg finish
        # over their last 10 shared races. Negative = beats teammate (better).
        teammates = past_results[
            (past_results["constructorId"] == constructor_id) &
            (past_results["driverCode"] != driver_code)
        ]["driverCode"].unique()
        if len(teammates) > 0:
            shared = past_results[
                past_results["constructorId"] == constructor_id
            ].sort_values(["season", "round"]).tail(30)
            driver_shared = shared[shared["driverCode"] == driver_code]["position"].values
            teammate_shared = shared[shared["driverCode"].isin(teammates)].groupby(["season", "round"])["position"].min().values
            min_len = min(len(driver_shared), len(teammate_shared), 10)
            if min_len > 0:
                feats["teammate_finish_gap"] = float(np.mean(driver_shared[-min_len:]) - np.mean(teammate_shared[-min_len:]))
            else:
                feats["teammate_finish_gap"] = 0.0
        else:
            feats["teammate_finish_gap"] = 0.0
    else:
        feats["team_reliability_score"] = 0.9
        feats["team_race_pace_rank"] = 10.0
        feats["teammate_finish_gap"] = 0.0

    # ---- FP2 pace delta + tire degradation ----
    if not fp_pace_df.empty and driver_code in fp_pace_df["driverCode"].values:
        fp_row = fp_pace_df[fp_pace_df["driverCode"] == driver_code].iloc[0]
        feats["fp_pace_delta_pct"] = float(fp_row["fp_pace_delta_pct"])
        if "fp2_tire_deg_pct" in fp_row.index and pd.notna(fp_row["fp2_tire_deg_pct"]):
            feats["fp2_tire_deg_pct"] = float(fp_row["fp2_tire_deg_pct"])
        else:
            feats["fp2_tire_deg_pct"] = float(fp_pace_df["fp2_tire_deg_pct"].median()) if "fp2_tire_deg_pct" in fp_pace_df.columns else 0.15
    else:
        feats["fp_pace_delta_pct"] = (feats["team_race_pace_rank"] - 1) * 0.15
        feats["fp2_tire_deg_pct"] = 0.15

    # ---- Circuit type (looked up from circuit name, never hardcoded) ----
    circuit_type = race_meta.get("circuit_type") or get_circuit_type(race_meta.get("circuit", ""))
    feats["overtake_difficulty"] = get_overtake_difficulty(race_meta.get("circuit", ""), circuit_type)

    # ---- Constructor championship position ----
    if not con_standings_df.empty and constructor_id and "constructorId" in con_standings_df.columns:
        crow = con_standings_df[con_standings_df["constructorId"] == constructor_id]
        con_field_size = max(len(con_standings_df), 1)
        if not crow.empty:
            feats["constructor_champ_pos_norm"] = float(crow.iloc[0]["position"]) / con_field_size
        else:
            feats["constructor_champ_pos_norm"] = 1.0  # unknown = last
    else:
        feats["constructor_champ_pos_norm"] = 0.5  # neutral default

    # ---- Championship standing ----
    # Uses standings from prior round (or prior season for round 1) to avoid
    # leakage. Normalised to [0, 1] by dividing by field size so it's
    # comparable across different grid sizes.
    if not standings_df.empty and "driverCode" in standings_df.columns:
        drow = standings_df[standings_df["driverCode"] == driver_code]
        field_size = max(len(standings_df), 1)
        if not drow.empty:
            feats["champ_position_norm"] = float(drow.iloc[0]["position"]) / field_size
            feats["champ_points"] = float(drow.iloc[0]["points"])
        else:
            # Driver not in standings yet (new to grid) — treat as last place
            feats["champ_position_norm"] = 1.0
            feats["champ_points"] = 0.0
    else:
        feats["champ_position_norm"] = 0.5  # neutral default
        feats["champ_points"] = 0.0

    # ---- Sprint result ----
    # NaN when no sprint this weekend; model learns to ignore it for non-sprint rounds.
    # has_sprint is a binary flag so the model knows when sprint features are real data
    # vs median-imputed noise — letting it weight sprint_position/pace appropriately.
    if not sprint_df.empty and "driverCode" in sprint_df.columns and "sprint_position" in sprint_df.columns:
        feats["has_sprint"] = 1.0
        srow = sprint_df[sprint_df["driverCode"] == driver_code]
        if not srow.empty:
            feats["sprint_position"] = float(srow.iloc[0]["sprint_position"])
        else:
            feats["sprint_position"] = float(len(sprint_df) + 1)
        # sprint_quali_delta: negative = gained positions in sprint vs qualifying (race pace > quali pace)
        feats["sprint_quali_delta"] = feats["sprint_position"] - feats["quali_position"]
    else:
        feats["has_sprint"] = 0.0
        feats["sprint_position"] = np.nan
        feats["sprint_quali_delta"] = 0.0

    # ---- Sprint pace delta ----
    # Race-condition lap times from the sprint — more predictive than practice pace.
    # NaN for non-sprint weekends.
    if not sprint_df.empty and "fastest_lap_time" in sprint_df.columns:
        sprint_times = {}
        for _, spr_row in sprint_df.iterrows():
            t = _time_str_to_seconds(spr_row.get("fastest_lap_time"))
            if t is not None:
                sprint_times[spr_row["driverCode"]] = t
        if sprint_times:
            fastest_sprint = min(sprint_times.values())
            driver_sprint_time = sprint_times.get(driver_code)
            if driver_sprint_time is not None:
                feats["sprint_pace_delta_pct"] = (driver_sprint_time - fastest_sprint) / fastest_sprint * 100
            else:
                feats["sprint_pace_delta_pct"] = np.nan
        else:
            feats["sprint_pace_delta_pct"] = np.nan
    else:
        feats["sprint_pace_delta_pct"] = np.nan

    # ---- Weather features ----
    feats["is_raining"] = int(weather_dict.get("is_raining", 0))
    feats["track_temp_celsius"] = float(weather_dict.get("track_temp_celsius", 30.0))

    # ---- Season weight (applied as sample_weight, not a model feature) ----
    # (stored separately in build_race_features)

    return feats


def _parse_quali_times(quali_df: pd.DataFrame) -> dict[str, float | None]:
    """Convert qualifying time strings ('1:23.456') to seconds."""
    out: dict[str, float | None] = {}
    for _, row in quali_df.iterrows():
        t = row.get("best_time")
        out[row["driverCode"]] = _time_to_seconds(t)
    return out


def _time_to_seconds(t: str | None) -> float | None:
    if not t or not isinstance(t, str):
        return None
    try:
        parts = t.split(":")
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return float(t)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Build inference features for an upcoming race
# ---------------------------------------------------------------------------

def build_inference_features(
    year: int,
    round_num: int,
    race_meta: dict,
    all_past_results: pd.DataFrame,
    drivers: list[str] | None = None,
) -> pd.DataFrame:
    """
    Build feature rows for prediction (no labels).
    drivers: list of driver codes to predict for. Defaults to all 2026 drivers.
    """
    if drivers is None:
        drivers = list(DRIVERS_2026.keys())

    try:
        quali = get_qualifying_results(year, round_num)
    except Exception:
        quali = pd.DataFrame()

    fp_pace = pd.DataFrame()
    try:
        fp_pace = get_fp2_long_run_pace(year, round_num)
    except Exception:
        pass
    if fp_pace.empty:
        for session in ("Practice 3", "Practice 2", "Practice 1"):
            try:
                fp_pace = get_fp_pace(year, round_num, session)
                if not fp_pace.empty:
                    break
            except Exception:
                pass
    if fp_pace.empty:
        fp_pace = _sprint_pace_df(year, round_num)

    sprint_results = pd.DataFrame()
    try:
        sprint_results = get_sprint_results(year, round_num)
    except Exception:
        pass

    try:
        if round_num == 1:
            standings = get_driver_standings(year - 1)
            con_standings = get_constructor_standings(year - 1)
        else:
            standings = get_driver_standings(year, round_num - 1)
            con_standings = get_constructor_standings(year, round_num - 1)
    except Exception:
        standings = pd.DataFrame()
        con_standings = pd.DataFrame()

    try:
        weather_dict = get_race_weather(
            year, round_num,
            race_date=race_meta.get("date"),
            lat=float(race_meta["lat"]) if race_meta.get("lat") else None,
            lon=float(race_meta["lon"]) if race_meta.get("lon") else None,
            race_datetime_utc=race_meta.get("race_datetime"),
        )
    except Exception:
        weather_dict = {"is_raining": 0, "track_temp_celsius": 30.0}

    rows = []
    for code in drivers:
        feats = _driver_features(
            driver_code=code,
            year=year,
            round_num=round_num,
            race_meta=race_meta,
            past_results=all_past_results,
            quali_df=quali,
            fp_pace_df=fp_pace,
            standings_df=standings,
            con_standings_df=con_standings,
            weather_dict=weather_dict,
            sprint_df=sprint_results,
        )
        feats["season"] = year
        feats["round"] = round_num
        rows.append(feats)

    return pd.DataFrame(rows)


FEATURE_COLS = [
    "quali_position",
    "quali_gap_to_pole_pct",
    "recent_form_5",
    "dnf_rate_10",
    "circuit_hist_avg",
    "team_reliability_score",
    "fp_pace_delta_pct",
    "overtake_difficulty",
    "positions_gained_avg",
    "team_race_pace_rank",
    "champ_position_norm",
    "champ_points",
    "career_win_rate",
    "career_podium_rate",
    "constructor_champ_pos_norm",
    "recent_season_avg_pos",
    "circuit_positions_gained_avg",
    "has_sprint",
    "sprint_position",
    "sprint_quali_delta",
    "sprint_pace_delta_pct",
    "is_raining",
    "track_temp_celsius",
    "fp2_tire_deg_pct",
    # circuit_chaos_rate: tested, contributes 0% — removed
    # teammate_finish_gap: tested, +win but -podium, net zero — removed
]
