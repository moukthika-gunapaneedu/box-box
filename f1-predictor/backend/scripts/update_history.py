"""
After each race: fetch actual result, compare to prediction, update history.json.
Optionally retriggers model training if enough new 2026 data exists.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

from collect_data import get_race_results, get_race_calendar

FRONTEND_DATA = Path(__file__).parent.parent.parent / "frontend" / "public" / "data"
FRONTEND_DATA.mkdir(parents=True, exist_ok=True)

CURRENT_SEASON = 2026
RETRAIN_THRESHOLD = 4  # retrain after every 4 completed races


def update(round_num: int) -> None:
    """Fetch race result and update history.json with prediction vs actual."""
    calendar = get_race_calendar(CURRENT_SEASON)
    race_meta = next((r for r in calendar if r["round"] == round_num), None)
    if not race_meta:
        print(f"Round {round_num} not found in calendar.")
        return

    print(f"Updating history for: {race_meta['name']} (Round {round_num})")

    # Fetch actual result
    results_df = get_race_results(CURRENT_SEASON, round_num)
    if results_df.empty:
        print("No race result available yet.")
        return

    actual_winner = results_df[results_df["position"] == 1].iloc[0]["driverCode"]
    actual_podium = results_df[results_df["position"] <= 3]["driverCode"].tolist()

    # Load previous prediction
    pred_path = FRONTEND_DATA / "predictions.json"
    pred_winner = "N/A"
    pred_podium = []
    pred_top3 = []
    if pred_path.exists():
        pred_data = json.loads(pred_path.read_text())
        if pred_data.get("round") == round_num:
            top3 = pred_data["predictions"][:3]
            pred_winner = top3[0]["driver_code"]
            pred_podium = [p["driver_code"] for p in top3]
            pred_top3 = [
                {
                    "driver_code": p["driver_code"],
                    "driver_name": p["driver_name"],
                    "team": p["team"],
                    "team_color": p["team_color"],
                    "win_probability": p["win_probability"],
                    "podium_probability": p["podium_probability"],
                }
                for p in top3
            ]

    correct_win = pred_winner == actual_winner
    podium_hits = len(set(pred_podium) & set(actual_podium))

    # Build actual top3 with driver details from results
    from utils import DRIVERS_2026, TEAM_COLORS
    actual_top3 = []
    for code in actual_podium:
        info = DRIVERS_2026.get(code, {})
        team = info.get("team", "")
        actual_top3.append({
            "driver_code": code,
            "driver_name": info.get("name", code),
            "team": team,
            "team_color": TEAM_COLORS.get(team, "#888888"),
        })

    new_entry = {
        "round": round_num,
        "race": race_meta["name"],
        "circuit": race_meta["circuit"],
        "race_date": race_meta["date"],
        "predicted_winner": pred_winner,
        "actual_winner": actual_winner,
        "correct_win": correct_win,
        "predicted_podium": pred_podium,
        "actual_podium": actual_podium,
        "podium_hits": podium_hits,
        "predicted_top3": pred_top3,
        "actual_top3": actual_top3,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    print(f"Result: {'CORRECT' if correct_win else 'WRONG'} — predicted {pred_winner}, actual {actual_winner}")

    # Load and update history
    history = _load_history()
    # Remove existing entry for this round if any
    history["results"] = [r for r in history["results"] if r["round"] != round_num]
    history["results"].append(new_entry)
    history["results"].sort(key=lambda x: x["round"])

    # Recalculate season accuracy
    completed = history["results"]
    if completed:
        history["season_winner_accuracy"] = round(
            sum(1 for r in completed if r["correct_win"]) / len(completed), 3
        )
        history["season_podium_accuracy"] = round(
            sum(r["podium_hits"] for r in completed) / (len(completed) * 3), 3
        )

    history_path = FRONTEND_DATA / "history.json"
    history_path.write_text(json.dumps(history, indent=2))
    print(f"History updated: {history_path}")

    # Trigger retraining if threshold reached
    if len(completed) % RETRAIN_THRESHOLD == 0 and len(completed) > 0:
        print(f"\n{len(completed)} races complete — triggering model retraining...")
        try:
            from train_model import train
            metrics = train()
            print(f"Retrain metrics: {metrics}")
        except Exception as exc:
            print(f"Retraining failed: {exc}")


def _load_history() -> dict:
    hp = FRONTEND_DATA / "history.json"
    if hp.exists():
        return json.loads(hp.read_text())
    return {"results": [], "season_winner_accuracy": None, "season_podium_accuracy": None}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python update_history.py <round_number>")
        sys.exit(1)
    update(int(sys.argv[1]))
