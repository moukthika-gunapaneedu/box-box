# box-box

![box-box](./box-box.jpg)

> *"Box, box."* - Bono, probably.

An AI-powered Formula 1 race prediction platform for the 2026 season. Box-box combines real-time qualifying data, practice pace, historical performance, and machine learning to predict race winners, podium finishes, and driver positions - before lights out.

---

## Features

- **Three-model ensemble**: XGBoost win classifier, LightGBM podium classifier, XGBoost position regressor
- **Live data integration**: qualifying results and race results from Jolpica/Ergast; FP2 long-run race pace from FastF1 (primary) with OpenF1 as fallback; weather forecasts from Open-Meteo
- **Advanced feature engineering**: grid position, 5-race rolling form, team pace ranking, circuit-specific performance, overtaking tendency, and reliability scores
- **Confidence scoring**: High/Medium/Low confidence with human-readable factors ("Starting from pole", "Excellent recent form")
- **Sprint race features**: sprint finishing position, sprint vs qualifying position delta, and sprint pace gap are included as training features on sprint weekends
- **Data freshness levels**: predictions are tagged as `pre-weekend`, `post-fp`, `post-qualifying`, `post-sprint`, or `race-day` depending on what data was available when they were generated
- **Season accuracy tracking**: compares predictions against actual results after every race
- **Automatic retraining**: models retrain after every 4 completed races as new 2026 data comes in
- **CI/CD deployment**: push to `main` and GitHub Actions builds and deploys to GitHub Pages

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | Next.js 15, React 18, TypeScript, TailwindCSS, Recharts, Framer Motion, Radix UI |
| Backend | Python 3.11, XGBoost, LightGBM, scikit-learn, pandas |
| Data | FastF1, OpenF1 API, Jolpica (Ergast replacement), Open-Meteo |
| Deploy | GitHub Pages + GitHub Actions |

---

## Project Structure

```
box-box/
└── f1-predictor/
    ├── backend/
    │   ├── scripts/
    │   │   ├── collect_data.py        # Fetch from OpenF1 & Jolpica APIs with caching + retry
    │   │   ├── feature_engineer.py    # Build feature matrices for training and inference
    │   │   ├── train_model.py         # Train XGBoost + LightGBM ensemble with TimeSeriesSplit
    │   │   ├── predict_race.py        # Generate race predictions with probability calibration
    │   │   ├── update_history.py      # Record post-race results and trigger retraining
    │   │   └── utils.py               # Driver roster, team colors, circuit classifications
    │   ├── models/
    │   │   ├── xgb_win.pkl            # XGBoost winner classifier
    │   │   ├── lgb_podium.pkl         # LightGBM podium classifier
    │   │   ├── xgb_position.pkl       # XGBoost position regressor
    │   │   └── metrics.json           # CV accuracy metrics
    │   ├── data/
    │   │   ├── cache/                 # MD5-keyed API response cache (configurable TTL)
    │   │   ├── grid_penalty_overrides.json  # Manually-maintained post-penalty grid positions (no API publishes these pre-race)
    │   │   └── training_features.parquet
    │   └── requirements.txt
    └── frontend/
        ├── public/
        │   └── data/                  # Static JSON consumed by the frontend
        │       ├── predictions.json   # Current race predictions
        │       ├── history.json       # Post-race results + season accuracy
        │       ├── calendar.json      # 2026 season calendar
        │       └── metrics.json       # CV accuracy metrics
        └── src/
            ├── app/                   # Pages: home, drivers, races, model
            ├── components/            # Race cards, charts, layout, UI primitives
            ├── hooks/                 # Custom React hooks (e.g. countdown timer)
            └── lib/                   # TypeScript types, data loaders, utilities
```

---

## How It Works

### Prediction Pipeline

1. **Data collection**: `collect_data.py` fetches qualifying results, standings, and weather from Jolpica and OpenF1. FP2 long-run race pace is extracted via FastF1 (primary — clean stint IDs and proper pit-stop detection) with OpenF1 raw laps as fallback. Responses are cached with MD5-keyed files and configurable TTL. Failed requests retry up to 3 times with exponential backoff.
2. **Feature engineering**: `feature_engineer.py` builds a 25-feature matrix per driver per race. Temporal guards prevent future data from leaking into training windows.
3. **Inference**: `predict_race.py` loads the trained models, runs all three, and calibrates output probabilities using a fitted logistic (Platt) recalibration — a smooth, strictly rank-preserving transform fit by minimizing log-loss against actual winners on held-out CV predictions. Win probabilities are normalized to sum to 1.0; podium probabilities are normalized to sum to 3.0. A grid-position blend then corrects for the raw model going flat past ~P8 (heavier at near-impossible-to-overtake circuits like Monaco/Singapore/Hungaroring, lighter elsewhere). If models aren't available, a fallback heuristic scores drivers using qualifying position, recent form, and team pace.
4. **Output**: predictions are written to `frontend/public/data/predictions.json` and picked up by the static Next.js build.
5. **Post-race**: `update_history.py` records actual results, compares against predictions, and updates `history.json`. After every 4 completed races, the models retrain on the expanded dataset.

### Feature Engineering

Each driver-race row is built from:

| Feature | Description |
|---|---|
| `quali_position` | Starting grid position |
| `quali_gap_to_pole_pct` | Best quali lap as % behind pole |
| `recent_form_5` | Average finishing position over last 5 races |
| `recent_season_avg_pos` | Driver's average finish in their most recent complete season |
| `dnf_rate_10` | DNF rate over last 10 races (DNS/DSQ events excluded) |
| `career_win_rate` | Career win rate, recency-weighted (2026 = 5×, 2025 = 1×, 2024 = 0.5×, 2023 = 0.25×) |
| `career_podium_rate` | Career podium rate, recency-weighted by season |
| `circuit_hist_avg` | Driver's avg finish at this circuit with current team only; exponentially recency-weighted; Retired results excluded |
| `circuit_positions_gained_avg` | Average positions gained grid→finish specifically at this circuit with current team. Separates "finishes well here" from "starts well here" — critical at Monaco-type tracks |
| `overtake_difficulty` | How easy it is to overtake: higher = more opportunities (Spa/Monza 0.8), lower = grid is destiny (Monaco 0.05, Singapore 0.10). Per-circuit overrides take priority over circuit-type defaults |
| `team_reliability_score` | Team DNF rate; DNS/DSQ events excluded from denominator |
| `fp_pace_delta_pct` | FP2 long-run median pace gap to session leader as % (best stint of 5+ laps, skipping first 2 laps). Sourced from FastF1 for clean stint detection; falls back to OpenF1 raw laps, then FP3→FP2→FP1 best lap. Sprint lap used on sprint weekends |
| `fp2_tire_deg_pct` | Tire degradation rate from FP2 long runs: linear slope of lap times divided by median pace × 100 (% per lap). Higher = more deg. Falls back to 0 if long-run data unavailable |
| `is_raining` | Wet/dry condition flag |
| `track_temp_celsius` | Track temperature at race start |
| `champ_position_norm` | Driver's championship position, normalised 0–1 |
| `champ_points` | Driver's championship points from the prior round |
| `constructor_champ_pos_norm` | Team's constructor championship position, normalised 0–1 |
| `team_race_pace_rank` | Team's avg finishing position over recent races (DNS/DSQ excluded) |
| `positions_gained_avg` | Average positions gained grid→finish over recent races (DNS/DSQ excluded) |
| `has_sprint` | 1 if sprint race data exists this weekend, 0 otherwise |
| `sprint_position` | Sprint race finishing position (NaN on non-sprint weekends) |
| `sprint_quali_delta` | Sprint position minus qualifying position (negative = gained positions) |
| `sprint_pace_delta_pct` | Sprint best lap vs session fastest, as % |
| `fp_pace_is_long_run` | Flags whether `fp_pace_delta_pct` came from a genuine long run (1) or a single-lap fallback (0) — a long run is a materially cleaner signal |

### Model Details

All three models share similar hyperparameters: 300 estimators, learning rate 0.05, max depth 4–5. Training uses median imputation for missing values and sample weights that give 2026 race results 5× the weight of 2025 data to reflect the new regulations. Cross-validation uses 4-fold `TimeSeriesSplit` grouped by (season, round) to prevent temporal leakage. The position regressor is trained with a MAE-native loss (`reg:absoluteerror`), not squared error — squared error was found to tie the trivial "finish == grid position" baseline exactly.

| Model | Algorithm | Target | CV Accuracy |
|---|---|---|---|
| Win classifier | XGBoost | Race winner | 68.8% |
| Podium classifier | LightGBM | Top-3 finish | 68.2% |
| Position regressor | XGBoost | Final position | MAE 3.17 (vs 3.32 grid-only baseline) |

Evaluated across 64 races (2023–2026 historical + 2026 season-to-date) using 4-fold TimeSeriesSplit.

---

## Automated Scheduling

The `predict.yml` workflow runs automatically three times each race weekend via GitHub Actions:

| Time (UTC) | Trigger | Action |
|---|---|---|
| Saturday 17:30 | Post-qualifying | Regenerate predictions with quali data |
| Sunday 10:00 | Race morning | Refresh predictions before lights out |
| Sunday 17:00 | Post-race | Record results, update accuracy, retrain if threshold met |

The workflow can also be triggered manually with inputs for `round_number` and `mode` (`predict` / `update_history` / `train`).

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+

### Frontend

```bash
cd f1-predictor/frontend
npm install
npm run dev        # http://localhost:3000
```

### Backend

```bash
cd f1-predictor/backend
pip install -r requirements.txt

python scripts/collect_data.py         # Fetch and cache latest API data
python scripts/train_model.py          # Train models on historical data
python scripts/predict_race.py         # Predict current race (auto-detects round)
python scripts/predict_race.py 5       # Predict a specific round
python scripts/update_history.py       # Record actual results + update accuracy
```

---

## Deployment

Push to `main` - GitHub Actions handles the rest. The frontend exports to static HTML/CSS/JS (Next.js static export via `next build`) and is deployed to GitHub Pages automatically via the `deploy.yml` workflow.
