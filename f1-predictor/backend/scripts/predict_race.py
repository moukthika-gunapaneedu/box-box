"""
Generate race winner predictions and write to frontend/public/data/predictions.json.

Run this after qualifying (Saturday evening) for best accuracy.
"""

from __future__ import annotations
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from feature_engineer import build_inference_features, FEATURE_COLS
from collect_data import get_race_results, get_race_calendar
from utils import DRIVERS_2026, TEAM_COLORS, OVERTAKE_INDEX, season_weight

MODELS_DIR = Path(__file__).parent.parent / "models"
DATA_DIR = Path(__file__).parent.parent / "data"
FRONTEND_DATA = Path(__file__).parent.parent.parent / "frontend" / "public" / "data"
FRONTEND_DATA.mkdir(parents=True, exist_ok=True)

CURRENT_SEASON = 2026


def load_models() -> tuple:
    """Load trained models from disk."""
    xgb_win = joblib.load(MODELS_DIR / "xgb_win.pkl")
    lgb_pod = joblib.load(MODELS_DIR / "lgb_podium.pkl")
    xgb_pos = joblib.load(MODELS_DIR / "xgb_position.pkl")
    return xgb_win, lgb_pod, xgb_pos


def get_live_calendar() -> list[dict]:
    """Fetch the real season calendar from Jolpica API."""
    calendar = get_race_calendar(CURRENT_SEASON)
    if not calendar:
        raise RuntimeError(f"Could not fetch {CURRENT_SEASON} calendar from API")
    return calendar


def get_current_round() -> tuple[int, dict]:
    """Return the current/next race round using the live API calendar."""
    from datetime import timedelta
    calendar = get_live_calendar()
    today = datetime.now(timezone.utc).date()

    # First: check if we're in a race weekend window (Thu–Sun)
    for race in calendar:
        if not race.get("date"):
            continue
        race_date = datetime.strptime(race["date"], "%Y-%m-%d").date()
        if race_date - timedelta(days=3) <= today <= race_date:
            return race["round"], race

    # Otherwise: next upcoming race
    for race in calendar:
        if not race.get("date"):
            continue
        race_date = datetime.strptime(race["date"], "%Y-%m-%d").date()
        if race_date > today:
            return race["round"], race

    # Fallback: last race of the season
    return calendar[-1]["round"], calendar[-1]


def output_calendar_json(calendar: list[dict]) -> None:
    """Write calendar.json to frontend public/data for the frontend to consume."""
    out = []
    for r in calendar:
        out.append({
            "round": r["round"],
            "name": r["name"],
            "circuit": r["circuit"],
            "country": r.get("country", ""),
            "locality": r.get("locality", ""),
            "date": r.get("date", ""),
            "race_datetime": r.get("race_datetime", ""),
        })
    path = FRONTEND_DATA / "calendar.json"
    path.write_text(json.dumps({"season": CURRENT_SEASON, "races": out}, indent=2))
    print(f"Calendar written to {path}")


def load_all_past_results() -> pd.DataFrame:
    """Load all historical + current season results for feature computation."""
    frames: list[pd.DataFrame] = []
    for year in [2022, 2023, 2024, 2025, CURRENT_SEASON]:
        calendar = get_race_calendar(year)
        for race in calendar:
            try:
                r = get_race_results(year, race["round"])
                if not r.empty:
                    r["circuit"] = race.get("circuit", "")
                    frames.append(r)
            except Exception:
                pass
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def predict(round_num: int | None = None) -> dict:
    """
    Generate predictions for a given race round.
    Returns the full predictions dict (also written to JSON).
    """
    # Fetch live calendar first — always use real API data
    calendar = get_live_calendar()
    output_calendar_json(calendar)

    # Determine race
    if round_num is None:
        round_num, race_meta = get_current_round()
    else:
        race_meta = next((r for r in calendar if r["round"] == round_num), calendar[0])

    print(f"Predicting: {race_meta['name']} (Round {round_num})")

    # Load past data
    print("Loading historical results...")
    all_past = load_all_past_results()

    # Build features
    print("Building inference features...")
    features_df = build_inference_features(
        year=CURRENT_SEASON,
        round_num=round_num,
        race_meta=race_meta,
        all_past_results=all_past,
    )

    drivers = features_df["driverCode"].tolist()
    X = features_df[FEATURE_COLS].fillna(features_df[FEATURE_COLS].median())

    # Load models (fall back to heuristic if not trained yet)
    try:
        xgb_win, lgb_pod, xgb_pos = load_models()
        win_probs = xgb_win.predict_proba(X)[:, 1]
        pod_probs = lgb_pod.predict_proba(X)[:, 1]
        pos_preds = xgb_pos.predict(X)
        model_source = "ml_ensemble"
    except Exception as exc:
        print(f"Models not available ({exc}), using heuristic fallback.")
        win_probs, pod_probs, pos_preds = _heuristic_predictions(features_df)
        model_source = "heuristic"

    # Normalize win probabilities to sum to 1
    win_probs = np.array(win_probs, dtype=float)
    win_probs = np.clip(win_probs, 0, 1)
    if win_probs.sum() > 0:
        win_probs = win_probs / win_probs.sum()

    # Normalize podium probabilities
    pod_probs = np.array(pod_probs, dtype=float)
    pod_probs = np.clip(pod_probs, 0, 1)

    # Build sorted predictions list
    results = []
    for i, code in enumerate(drivers):
        driver_info = DRIVERS_2026.get(code, {})
        team = driver_info.get("team", "Unknown")
        win_p = float(win_probs[i])
        pod_p = float(pod_probs[i])
        pos_p = float(pos_preds[i])
        confidence = _confidence(win_p, features_df.iloc[i])

        results.append({
            "driver_code": code,
            "driver_name": driver_info.get("name", code),
            "team": team,
            "team_color": TEAM_COLORS.get(team, "#888888"),
            "driver_number": driver_info.get("number", 0),
            "win_probability": round(win_p, 4),
            "podium_probability": round(pod_p, 4),
            "predicted_finish": round(max(1.0, pos_p), 1),
            "confidence": confidence,
            "key_factors": _key_factors(features_df.iloc[i], win_p),
            "quali_position": int(features_df.iloc[i].get("quali_position", 0)),
        })

    results.sort(key=lambda x: x["win_probability"], reverse=True)
    for i, r in enumerate(results):
        r["position"] = i + 1

    # Season accuracy from history
    history = _load_history()
    ytd_acc = history.get("season_winner_accuracy") or 0.0

    # Determine data freshness
    data_freshness = _data_freshness(features_df)

    output = {
        "race": race_meta["name"],
        "round": round_num,
        "circuit": race_meta["circuit"],
        "circuit_type": race_meta.get("circuit_type", "technical"),
        "predicted_at": datetime.now(timezone.utc).isoformat(),
        "data_freshness": data_freshness,
        "model_source": model_source,
        "model_accuracy_ytd": ytd_acc,
        "predictions": results,
        "race_date": race_meta.get("race_datetime") or f"{race_meta['date']}T00:00:00Z",
        "season": CURRENT_SEASON,
    }

    out_path = FRONTEND_DATA / "predictions.json"
    out_path.write_text(json.dumps(output, indent=2))
    print(f"Predictions written to {out_path}")
    return output


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _heuristic_predictions(df: pd.DataFrame) -> tuple:
    """
    Fallback when models aren't trained: score based on quali position + form.
    Lower = better. Invert for probability.
    """
    scores = (
        df["quali_position"] * 0.6 +
        df["recent_form_5"].fillna(10) * 0.2 +
        df["fp_pace_delta_pct"].fillna(5) * 0.2
    ).values

    # Convert to win probability (inverse rank-based)
    ranks = scores.argsort().argsort() + 1  # 1 = best
    win_probs = 1.0 / (ranks ** 1.5)
    win_probs = win_probs / win_probs.sum()

    pod_probs = 3.0 / ranks
    pod_probs = np.clip(pod_probs, 0, 0.95)

    pos_preds = ranks.astype(float)
    return win_probs, pod_probs, pos_preds


def _confidence(win_prob: float, row: pd.Series) -> str:
    quali_pos = row.get("quali_position", 10)
    if win_prob > 0.25 and quali_pos <= 3:
        return "high"
    if win_prob > 0.10 or quali_pos <= 6:
        return "medium"
    return "low"


def _key_factors(row: pd.Series, win_prob: float) -> list[str]:
    factors = []
    qp = int(row.get("quali_position", 20))
    if qp == 1:
        factors.append("Starting from pole")
    elif qp <= 3:
        factors.append(f"P{qp} on grid")
    elif qp <= 6:
        factors.append(f"P{qp} grid position")

    form = row.get("recent_form_5", 10)
    if form <= 3:
        factors.append("Excellent recent form")
    elif form <= 5:
        factors.append("Good recent form")

    if row.get("team_reliability_score", 0.9) > 0.95:
        factors.append("Reliable car")
    if row.get("dnf_rate_10", 0.1) > 0.3:
        factors.append("High DNF risk")
    if row.get("is_new_team", 0) == 1:
        factors.append("New team — limited data")
    if row.get("fp_pace_delta_pct", 5) < 0.5:
        factors.append("Strong practice pace")

    return factors[:3] or ["No standout factors"]


def _data_freshness(df: pd.DataFrame) -> str:
    has_quali = df["quali_position"].notna().any() and (df["quali_position"] != 15).any()
    has_fp = df["fp_pace_delta_pct"].notna().any()
    if has_quali:
        return "post-qualifying"
    if has_fp:
        return "post-fp"
    return "pre-weekend"


def _load_history() -> dict:
    hp = FRONTEND_DATA / "history.json"
    if hp.exists():
        return json.loads(hp.read_text())
    return {"results": [], "season_winner_accuracy": None, "season_podium_accuracy": None}


if __name__ == "__main__":
    rn = int(sys.argv[1]) if len(sys.argv) > 1 else None
    result = predict(rn)
    print(f"\nTop 3 predictions:")
    for p in result["predictions"][:3]:
        print(f"  P{p['position']} {p['driver_name']} ({p['team']}) — win: {p['win_probability']:.1%}")
