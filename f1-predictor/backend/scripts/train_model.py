"""
Train XGBoost + LightGBM ensemble for F1 race winner prediction.

Models trained:
  1. xgb_win  — XGBoost classifier: win probability (position == 1)
  2. lgb_podium — LightGBM classifier: podium probability (position <= 3)
  3. xgb_position — XGBoost regressor: predicted finishing position

All models use TimeSeriesSplit to avoid data leakage.
"""

from __future__ import annotations
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, log_loss
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import lightgbm as lgb

from feature_engineer import build_training_dataset, FEATURE_COLS

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)
DATA_DIR = Path(__file__).parent.parent / "data"


def train() -> dict:
    """Full training pipeline. Returns dict with validation metrics."""
    print("Building training dataset...")
    df = build_training_dataset()

    if df.empty:
        print("No training data available. Aborting.")
        return {}

    # Persist dataset for inspection
    df.to_parquet(DATA_DIR / "training_features.parquet", index=False)
    print(f"Dataset: {len(df)} rows, {df['season'].nunique()} seasons")

    X = df[FEATURE_COLS].fillna(df[FEATURE_COLS].median())
    y_win = df["win"]
    y_podium = df["podium"]
    y_pos = df["finishing_position"]
    weights = df["sample_weight"]

    # TimeSeriesSplit: sort by (season, round)
    df_sorted = df.sort_values(["season", "round"])
    sort_idx = df_sorted.index
    X_s = X.loc[sort_idx]
    y_win_s = y_win.loc[sort_idx]
    y_podium_s = y_podium.loc[sort_idx]
    y_pos_s = y_pos.loc[sort_idx]
    w_s = weights.loc[sort_idx]

    tscv = TimeSeriesSplit(n_splits=4)

    # ---- XGBoost win classifier ----
    xgb_win_params = {
        "objective": "binary:logistic",
        "n_estimators": 300,
        "max_depth": 4,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "scale_pos_weight": (len(y_win_s) - y_win_s.sum()) / y_win_s.sum(),
        "eval_metric": "logloss",
        "random_state": 42,
    }
    xgb_win_model = xgb.XGBClassifier(**xgb_win_params)

    # ---- LightGBM podium classifier ----
    lgb_podium_params = {
        "objective": "binary",
        "n_estimators": 300,
        "max_depth": 5,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "is_unbalance": True,
        "random_state": 42,
        "verbose": -1,
    }
    lgb_podium_model = lgb.LGBMClassifier(**lgb_podium_params)

    # ---- XGBoost position regressor ----
    xgb_pos_params = {
        "objective": "reg:squarederror",
        "n_estimators": 300,
        "max_depth": 5,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": 42,
    }
    xgb_pos_model = xgb.XGBRegressor(**xgb_pos_params)

    # ---- Cross-validation metrics ----
    # Track (val_idx, win_prob, pod_prob) so we can align predictions to the
    # correct rows in df_sorted — previously predictions were matched to the
    # wrong rows causing 0% winner accuracy.
    cv_records: list[tuple[int, float, float]] = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X_s)):
        Xtr, Xval = X_s.iloc[train_idx], X_s.iloc[val_idx]
        ytr_w, yval_w = y_win_s.iloc[train_idx], y_win_s.iloc[val_idx]
        ytr_p, yval_p = y_podium_s.iloc[train_idx], y_podium_s.iloc[val_idx]
        wtr = w_s.iloc[train_idx]

        m_win = xgb.XGBClassifier(**xgb_win_params)
        m_win.fit(Xtr, ytr_w, sample_weight=wtr, verbose=False)
        win_probs_fold = m_win.predict_proba(Xval)[:, 1].tolist()

        m_pod = lgb.LGBMClassifier(**lgb_podium_params)
        m_pod.fit(Xtr, ytr_p, sample_weight=wtr)
        pod_probs_fold = m_pod.predict_proba(Xval)[:, 1].tolist()

        for row_idx, wp, pp in zip(val_idx, win_probs_fold, pod_probs_fold):
            cv_records.append((row_idx, wp, pp))
        print(f"  Fold {fold+1} done")

    # Winner accuracy: predicted winner = driver with max win_prob per race
    metrics = _compute_cv_metrics(cv_records, df_sorted)
    print(f"\nCV Metrics: {json.dumps(metrics, indent=2)}")

    # ---- Final training on all data ----
    print("\nTraining final models on full dataset...")
    xgb_win_model.fit(X_s, y_win_s, sample_weight=w_s, verbose=False)
    lgb_podium_model.fit(X_s, y_podium_s, sample_weight=w_s)
    xgb_pos_model.fit(X_s, y_pos_s, sample_weight=w_s, verbose=False)

    # Save models
    joblib.dump(xgb_win_model, MODELS_DIR / "xgb_win.pkl")
    joblib.dump(lgb_podium_model, MODELS_DIR / "lgb_podium.pkl")
    joblib.dump(xgb_pos_model, MODELS_DIR / "xgb_position.pkl")
    print("Models saved to models/")

    # Save metrics — backend and frontend both get a copy
    metrics_json = json.dumps(metrics, indent=2)
    (MODELS_DIR / "metrics.json").write_text(metrics_json)
    frontend_data = Path(__file__).parent.parent.parent / "frontend" / "public" / "data"
    frontend_data.mkdir(parents=True, exist_ok=True)
    (frontend_data / "metrics.json").write_text(metrics_json)
    print(f"Metrics written to models/ and frontend/public/data/")
    return metrics


def _compute_cv_metrics(
    cv_records: list[tuple[int, float, float]],
    df_sorted: pd.DataFrame,
) -> dict:
    """Compute winner accuracy and podium accuracy from CV fold predictions.

    cv_records: list of (row_idx_in_df_sorted, win_prob, pod_prob) — one per
    driver per race, using the actual validation row index so predictions are
    aligned to the correct races.
    """
    df_cv = df_sorted.copy().reset_index(drop=True)
    df_cv["win_prob_pred"] = np.nan
    df_cv["podium_prob_pred"] = np.nan
    for row_idx, wp, pp in cv_records:
        df_cv.at[row_idx, "win_prob_pred"] = wp
        df_cv.at[row_idx, "podium_prob_pred"] = pp
    # Only evaluate races where we have predictions
    df_cv = df_cv.dropna(subset=["win_prob_pred"])

    correct_wins = 0
    correct_podiums = 0
    total_races = 0

    for (season, rnd), grp in df_cv.groupby(["season", "round"]):
        total_races += 1
        pred_winner = grp.loc[grp["win_prob_pred"].idxmax(), "driverCode"]
        actual_winner_rows = grp[grp["win"] == 1]
        if not actual_winner_rows.empty:
            actual_winner = actual_winner_rows.iloc[0]["driverCode"]
            if pred_winner == actual_winner:
                correct_wins += 1

        top3_pred = set(grp.nlargest(3, "podium_prob_pred")["driverCode"])
        top3_actual = set(grp[grp["podium"] == 1]["driverCode"])
        podium_overlap = len(top3_pred & top3_actual)
        correct_podiums += podium_overlap / 3

    return {
        "winner_accuracy": round(correct_wins / max(total_races, 1), 3),
        "podium_accuracy": round(correct_podiums / max(total_races, 1), 3),
        "total_races_evaluated": total_races,
    }


if __name__ == "__main__":
    metrics = train()
    print("\nFinal metrics:", metrics)
