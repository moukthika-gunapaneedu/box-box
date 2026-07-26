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
from utils import DRIVERS_2026, TEAM_COLORS, OVERTAKE_INDEX, season_weight, get_circuit_type, get_overtake_difficulty

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

    # Normalize win probabilities to sum to 1, then recalibrate magnitude.
    # History: T=3 (guessed) -> T=1.5 power-scaling (fitted 2026-07-18 via
    # log-loss on the 63-race CV holdout). That fit also cross-checked isotonic
    # regression and noted it "would calibrate magnitude even better but
    # reintroduces the same flat-tail ranking problem" -- flagged as a real
    # follow-up, not resolved. Investigated 2026-07-26: isotonic on properly
    # per-race-normalized scores DOES beat power-scaling on log-loss (0.094 vs
    # 0.109 on 64-race held-out CV) but collapses ~1300 rows to ~12 distinct
    # calibrated values -- close non-favorites get tied and P3 exact-slot
    # accuracy drops from 12.7% to 4.8% because ties get broken arbitrarily.
    # Platt (logistic) scaling on the same per-race-normalized input is smooth
    # and strictly monotonic (a=0.850>0, b=-0.200; fit via LogisticRegression
    # on logit(win_prob_normalized) -> actual win, same 64-race CV), so it is
    # provably rank-preserving within a race -- confirmed empirically: P1/P2/P3
    # exact-slot accuracy identical to the old power-scaling, log-loss improves
    # ~4% (0.109 -> 0.105). This is the "properly combining" calibration the
    # 07-18 note deferred -- ships now with the accuracy-invariance verified,
    # not assumed.
    WIN_PLATT_A, WIN_PLATT_B = 0.8499, -0.2001
    win_probs = np.array(win_probs, dtype=float)
    win_probs = np.clip(win_probs, 1e-9, 1)
    win_probs = win_probs / win_probs.sum()
    win_logit = np.log(win_probs / (1 - win_probs))
    win_probs = 1.0 / (1.0 + np.exp(-(WIN_PLATT_A * win_logit + WIN_PLATT_B)))
    win_probs = win_probs / win_probs.sum()

    # Normalize podium probabilities: exactly 3 podium spots exist, so the sum
    # of all drivers' podium probabilities must equal 3.0. Without this, the
    # uncalibrated LGB model hands out inflated probabilities to everyone.
    # Platt-fit the same way as WIN above (a=0.672, b=1.191); the old T=1.8
    # power-scaling was already close to well-calibrated for podium, so this
    # is a smaller correction than the win-probability one.
    POD_PLATT_A, POD_PLATT_B = 0.6719, 1.1911
    pod_probs = np.array(pod_probs, dtype=float)
    pod_probs = np.clip(pod_probs, 1e-9, 1)
    pod_probs = pod_probs / pod_probs.sum()
    pod_logit = np.log(pod_probs / (1 - pod_probs))
    pod_probs = 1.0 / (1.0 + np.exp(-(POD_PLATT_A * pod_logit + POD_PLATT_B)))
    pod_probs = pod_probs / pod_probs.sum() * 3.0
    pod_probs = np.clip(pod_probs, 0, 1)

    # Enforce logical constraint: podium % >= win % (a win is a subset of a podium)
    pod_probs = np.maximum(pod_probs, win_probs)

    # Build sorted predictions list
    results = []
    for i, code in enumerate(drivers):
        driver_info = DRIVERS_2026.get(code, {})
        team = driver_info.get("team", "Unknown")
        win_p = float(win_probs[i])
        pod_p = float(pod_probs[i])
        pos_p = float(pos_preds[i])
        confidence = _confidence(win_p, pod_p, features_df.iloc[i])

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

    # For near-zero overtake circuits (Monaco, Singapore) the general model
    # can't learn grid-lock from 3-4 training examples: form/pace signals drown it out.
    # Blend toward historical grid-position base rates so P2/P3 aren't undervalued
    # and P7 isn't given a phantom 40%+ podium chance.
    circuit_od = get_overtake_difficulty(race_meta.get("circuit", ""))
    results = _apply_grid_lock_calibration(results, circuit_od)

    # Sort by win probability — P1 = most likely to win.
    # Podium % is normalized to sum to 3.0 so it's consistent with this ranking.
    results.sort(key=lambda x: x["win_probability"], reverse=True)
    for i, r in enumerate(results):
        r["position"] = i + 1

    # Fix predicted_finish: unique integer ranks from regression model,
    # ties broken by win_probability.
    results_by_pos = sorted(results, key=lambda x: (x["predicted_finish"], -x["win_probability"]))
    for rank, r in enumerate(results_by_pos, 1):
        r["predicted_finish"] = float(rank)

    # NOTE: quali_position on each result already reflects the actual post-penalty
    # starting grid (see feature_engineer.get_grid_overrides) — do not re-overlay
    # from raw qualifying classification here, that's the same unadjusted source
    # and will silently undo grid-penalty corrections.

    # Season accuracy from history
    history = _load_history()
    ytd_acc = history.get("season_winner_accuracy") or 0.0

    # Determine data freshness
    data_freshness = _data_freshness(features_df)

    output = {
        "race": race_meta["name"],
        "round": round_num,
        "circuit": race_meta["circuit"],
        "circuit_type": race_meta.get("circuit_type") or get_circuit_type(race_meta.get("circuit", "")),
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

def _apply_grid_lock_calibration(results: list, overtake_difficulty: float) -> list:
    """
    Blend model probabilities toward historical grid-position base rates.

    Confirmed by direct sensitivity testing (2026-07-18, R10 Belgian GP prep): the
    trained xgb_win model's raw output is completely flat with respect to
    quali_position past ~P8 (identical prediction whether a driver starts P8 or
    P21) — max_depth=4 combined with few training examples of "strong team,
    deep grid slot" means the trees never learned to split further down the
    grid. Past that point the ranking is driven entirely by team/career
    features, so a backmarker on a fast team (e.g. a penalised front-runner)
    outranks a genuinely quicker midfield car at the same grid slot. This
    isn't Monaco-specific — it's a general model capacity limit — so unlike
    the original version of this function, calibration is no longer gated off
    entirely for high-overtake circuits; it just blends in a lot less there.

    Two tiers:
      - overtake_difficulty < 0.15 (Monaco/Singapore-style): blend heavily
        toward hand-tuned priors derived from actual Monaco+Singapore races
        (2022-2025) — grid position there is close to deterministic, and the
        general all-circuit table below would be too soft for those tracks.
      - overtake_difficulty >= 0.15 (everywhere else): blend lightly toward
        GRID_WIN_PRIOR_GENERAL/GRID_POD_PRIOR_GENERAL, empirical win/podium
        rates by grid position across all 2023-2026 races (1596 driver-rows),
        isotonically smoothed (monotonic non-increasing) and floored so a
        deep-grid driver is suppressed but never literally zeroed out.
    """
    GRID_LOCK_THRESHOLD = 0.15

    # Hand-tuned Monaco/Singapore priors (unchanged from original).
    # P1: 75% (pole DNF once, 2022 LEC), P2/P3: 100%, P4: 25% (VER 2022 only), P5+: ~0%.
    GRID_POD_PRIOR_MONACO = {1: 0.75, 2: 0.95, 3: 0.95, 4: 0.20, 5: 0.04, 6: 0.02}
    GRID_WIN_PRIOR_MONACO = {1: 0.42, 2: 0.28, 3: 0.18, 4: 0.06, 5: 0.02, 6: 0.01}

    # Empirical, all-circuit win/podium rate by grid position (2023-2026, 1596 rows),
    # isotonically smoothed and floored (win >= 0.003, podium >= 0.01) so it never
    # forces a hard zero. Recompute from data/training_features.parquet if the
    # underlying dataset changes materially.
    GRID_WIN_PRIOR_GENERAL = {
        1: 0.595, 2: 0.215, 3: 0.089, 4: 0.038, 5: 0.013, 6: 0.013, 7: 0.003,
    }
    GRID_POD_PRIOR_GENERAL = {
        1: 0.823, 2: 0.734, 3: 0.468, 4: 0.392, 5: 0.215, 6: 0.101, 7: 0.063,
    }
    WIN_FLOOR_GENERAL, POD_FLOOR_GENERAL = 0.003, 0.01

    if overtake_difficulty < GRID_LOCK_THRESHOLD:
        blend = (GRID_LOCK_THRESHOLD - overtake_difficulty) / GRID_LOCK_THRESHOLD  # 0.05 → ~0.67
        pod_prior, win_prior = GRID_POD_PRIOR_MONACO, GRID_WIN_PRIOR_MONACO
        pod_default, win_default = 0.003, 0.002
    else:
        # Tapers from 0.20 at the threshold down to 0.06 at the highest overtake
        # difficulty in use (0.8, high_speed circuits like Spa/Monza).
        BLEND_MAX, BLEND_MIN, OD_MAX = 0.20, 0.06, 0.8
        span = max(OD_MAX - GRID_LOCK_THRESHOLD, 1e-9)
        frac = min(max((overtake_difficulty - GRID_LOCK_THRESHOLD) / span, 0.0), 1.0)
        blend = BLEND_MAX - (BLEND_MAX - BLEND_MIN) * frac
        pod_prior, win_prior = GRID_POD_PRIOR_GENERAL, GRID_WIN_PRIOR_GENERAL
        pod_default, win_default = POD_FLOOR_GENERAL, WIN_FLOOR_GENERAL

    for r in results:
        gp = r["quali_position"]
        r["podium_probability"] = (
            (1 - blend) * r["podium_probability"] + blend * pod_prior.get(gp, pod_default)
        )
        r["win_probability"] = (
            (1 - blend) * r["win_probability"] + blend * win_prior.get(gp, win_default)
        )

    # Re-normalise: win probs sum to 1, podium probs sum to 3
    win_sum = sum(r["win_probability"] for r in results)
    pod_sum = sum(r["podium_probability"] for r in results)
    for r in results:
        r["win_probability"] = round(r["win_probability"] / win_sum, 4)
        r["podium_probability"] = round(min(0.99, r["podium_probability"] / pod_sum * 3.0), 4)

    # Re-enforce podium >= win constraint after calibration. Bumping any row up
    # to its win floor breaks the sum-to-3 invariant from the renormalisation
    # above, so rescale only the slack (podium - win) proportionally to bring
    # the total back to exactly 3.0 — every row stays >= its win floor since
    # slack is clamped non-negative before scaling. (This bug pre-dates this
    # calibration extension — the original single-pass max() could already
    # push the sum over 3.0 — surfaced now because a fitted win temperature
    # widens the gap between a strong favourite's win and podium values.)
    for r in results:
        r["podium_probability"] = max(r["podium_probability"], r["win_probability"])
    win_total = sum(r["win_probability"] for r in results)
    slack_total = sum(r["podium_probability"] - r["win_probability"] for r in results)
    target_slack = 3.0 - win_total
    if slack_total > 1e-9:
        scale = target_slack / slack_total
        for r in results:
            slack = max(r["podium_probability"] - r["win_probability"], 0.0)
            r["podium_probability"] = round(r["win_probability"] + slack * scale, 4)

    return results


def _heuristic_predictions(df: pd.DataFrame) -> tuple:
    """
    Fallback when models aren't trained: score based on multiple signals.
    Lower = better. Invert for probability.
    Qualifying is one signal, not the dominant one.
    """
    # positions_gained_avg: higher = better, so negate it
    positions_gained = df["positions_gained_avg"].fillna(0)
    scores = (
        df["quali_position"].fillna(15) * 0.30 +
        df["recent_form_5"].fillna(10) * 0.25 +
        df["team_race_pace_rank"].fillna(10) * 0.25 +
        df["fp_pace_delta_pct"].fillna(2) * 0.10 +
        (-positions_gained).clip(lower=-10) * 0.10
    ).values

    # Convert to win probability (inverse rank-based)
    ranks = scores.argsort().argsort() + 1  # 1 = best
    win_probs = 1.0 / (ranks ** 1.5)
    win_probs = win_probs / win_probs.sum()

    pod_probs = 3.0 / ranks
    pod_probs = np.clip(pod_probs, 0, 0.95)

    pos_preds = ranks.astype(float)
    return win_probs, pod_probs, pos_preds


def _confidence(win_prob: float, pod_prob: float, row: pd.Series) -> str:
    quali_pos = row.get("quali_position", 10)
    if win_prob > 0.25 and quali_pos <= 3:
        return "high"
    if win_prob > 0.10 or pod_prob > 0.50 or quali_pos <= 6:
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
    has_sprint = "sprint_position" in df.columns and df["sprint_position"].notna().any()
    if has_quali:
        return "post-qualifying"
    if has_sprint:
        return "post-sprint"
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
