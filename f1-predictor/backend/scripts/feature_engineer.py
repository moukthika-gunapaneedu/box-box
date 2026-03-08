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
    get_constructor_standings,
    get_fp_pace,
)
from utils import season_weight, DRIVERS_2026, OVERTAKE_INDEX, get_circuit_type

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

HISTORY_SEASONS = [2022, 2023, 2024, 2025]


# ---------------------------------------------------------------------------
# Build historical feature dataset (training)
# ---------------------------------------------------------------------------

def build_training_dataset(seasons: list[int] = HISTORY_SEASONS) -> pd.DataFrame:
    """
    Build full feature + label DataFrame across multiple seasons.
    Label = finishing_position (and derived: win, podium).
    """
    all_rows: list[pd.DataFrame] = []

    for year in seasons:
        print(f"Building features for {year}...")
        try:
            from collect_data import get_race_calendar
            calendar = get_race_calendar(year)
        except Exception:
            calendar = []

        all_results_year: list[pd.DataFrame] = []
        for race in calendar:
            rn = race["round"]
            try:
                r = get_race_results(year, rn)
                if not r.empty:
                    all_results_year.append(r)
            except Exception:
                pass

        if not all_results_year:
            continue

        results_year = pd.concat(all_results_year, ignore_index=True)

        for race in calendar:
            rn = race["round"]
            try:
                row_df = _build_race_features(year, rn, results_year, race)
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

    # FP2 pace (skip if unavailable to keep training fast)
    try:
        fp_pace = get_fp_pace(year, round_num, "Practice 2")
    except Exception:
        fp_pace = pd.DataFrame()

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
) -> dict:
    """Compute all features for a single driver in a single race."""
    feats: dict = {"driverCode": driver_code}

    # ---- Qualifying features ----
    if not quali_df.empty and "driverCode" in quali_df.columns:
        dq = quali_df[quali_df["driverCode"] == driver_code]
        if not dq.empty:
            feats["quali_position"] = int(dq.iloc[0]["quali_position"])
        else:
            feats["quali_position"] = 15  # default mid-grid
    else:
        feats["quali_position"] = 15

    # Qualifying gap to pole (percentage)
    if not quali_df.empty and "best_time" in quali_df.columns:
        times = _parse_quali_times(quali_df)
        if times and driver_code in times and times[driver_code] is not None:
            pole_time = min(v for v in times.values() if v is not None)
            driver_time = times[driver_code]
            feats["quali_gap_to_pole_pct"] = (driver_time - pole_time) / pole_time * 100
        else:
            feats["quali_gap_to_pole_pct"] = 5.0
    else:
        feats["quali_gap_to_pole_pct"] = 5.0

    # ---- Recent form (last 5 races) ----
    driver_past = past_results[past_results["driverCode"] == driver_code].copy()
    if not driver_past.empty:
        last5 = driver_past.sort_values(["season", "round"]).tail(5)
        feats["recent_form_5"] = float(last5["position"].mean()) if len(last5) > 0 else 10.0
        last10 = driver_past.sort_values(["season", "round"]).tail(10)
        dnf_mask = ~last10["status"].str.lower().str.contains("finish", na=False)
        feats["dnf_rate_10"] = float(dnf_mask.mean())

        # Average positions gained from grid to finish (positive = charges forward)
        if "grid_position" in last5.columns:
            gains = last5["grid_position"] - last5["position"]
            feats["positions_gained_avg"] = float(gains.mean())
        else:
            feats["positions_gained_avg"] = 0.0
    else:
        feats["recent_form_5"] = 10.0
        feats["dnf_rate_10"] = 0.1
        feats["positions_gained_avg"] = 0.0

    # ---- Circuit historical average ----
    circuit = race_meta.get("circuit", "")
    circuit_past = driver_past[driver_past.get("circuit", pd.Series(dtype=str)) == circuit] if "circuit" in driver_past.columns else pd.DataFrame()
    if not circuit_past.empty:
        feats["circuit_hist_avg"] = float(circuit_past["position"].mean())
    else:
        feats["circuit_hist_avg"] = feats["recent_form_5"]  # fallback

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
            dnf_mask_team = ~team_past["status"].str.lower().str.contains("finish", na=False)
            feats["team_reliability_score"] = float(1 - dnf_mask_team.mean())
        else:
            feats["team_reliability_score"] = 0.9

        # Team race pace rank: average finishing position of the constructor
        # across recent races (lower = faster car, independent of qualifying)
        team_recent = past_results[past_results["constructorId"] == constructor_id].tail(20)
        feats["team_race_pace_rank"] = float(team_recent["position"].mean()) if not team_recent.empty else 10.0
    else:
        feats["team_reliability_score"] = 0.9
        feats["team_race_pace_rank"] = 10.0

    # ---- FP2 pace delta ----
    if not fp_pace_df.empty and driver_code in fp_pace_df["driverCode"].values:
        fp_row = fp_pace_df[fp_pace_df["driverCode"] == driver_code].iloc[0]
        feats["fp_pace_delta_pct"] = float(fp_row["fp_pace_delta_pct"])
    else:
        # Fall back to team race pace rank converted to a pace estimate,
        # not quali (which may itself be missing/wrong)
        feats["fp_pace_delta_pct"] = (feats["team_race_pace_rank"] - 1) * 0.15

    # ---- Circuit type (looked up from circuit name, never hardcoded) ----
    circuit_type = race_meta.get("circuit_type") or get_circuit_type(race_meta.get("circuit", ""))
    feats["overtake_difficulty"] = OVERTAKE_INDEX.get(circuit_type, 0.6)

    # ---- Is new team (Cadillac) ----
    driver_info = DRIVERS_2026.get(driver_code, {})
    feats["is_new_team"] = int(driver_info.get("team", "") == "Cadillac")

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

    try:
        fp_pace = get_fp_pace(year, round_num, "Practice 2")
    except Exception:
        fp_pace = pd.DataFrame()

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
    "is_new_team",
    "positions_gained_avg",
    "team_race_pace_rank",
]
