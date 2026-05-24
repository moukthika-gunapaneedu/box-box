# box-box

![box-box](./box-box.jpg)

> *"Box, box."* - Bono, probably.

An AI-powered Formula 1 race prediction platform for the 2026 season. Box-box combines real-time qualifying data, practice pace, historical performance, and machine learning to predict race winners, podium finishes, and driver positions - before lights out.

---

## Features

- **Three-model ensemble**: XGBoost win classifier, LightGBM podium classifier, XGBoost position regressor
- **Live data integration**: qualifying results, practice pace, and pit stop data from OpenF1 and Jolpica/Ergast APIs
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
| Backend | Python 3.11, XGBoost, LightGBM, scikit-learn, pandas, FastF1 |
| Data | OpenF1 API, Jolpica (Ergast replacement) |
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

1. **Data collection**: `collect_data.py` fetches qualifying results, practice pace, pit stop data, standings, and weather from OpenF1 and Jolpica. Responses are cached with MD5-keyed files and configurable TTL. Failed requests retry up to 3 times with exponential backoff.
2. **Feature engineering**: `feature_engineer.py` builds a 22-feature matrix per driver per race. Temporal guards prevent future data from leaking into training windows.
3. **Inference**: `predict_race.py` loads the trained models, runs all three, and calibrates output probabilities using temperature scaling (3.0 for wins, 2.0 for podiums). Win probabilities are normalized to sum to 1.0; podium probabilities are normalized to sum to 3.0. If models aren't available, a fallback heuristic scores drivers using qualifying position, recent form, and team pace.
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
| `career_win_rate` | Career win rate |
| `career_podium_rate` | Career podium rate |
| `circuit_hist_avg` | Driver's avg finish at this circuit with current team only; exponentially recency-weighted; Retired results excluded |
| `overtake_difficulty` | Circuit overtake index (0.3 street → 0.8 high-speed) |
| `team_reliability_score` | Team DNF rate; DNS/DSQ events excluded from denominator |
| `fp_pace_delta_pct` | Best practice lap gap to session leader as % (FP3→FP2→FP1; sprint lap used on sprint weekends) |
| `is_raining` | Wet/dry condition flag |
| `track_temp` | Track temperature at race start |
| `champ_position_norm` | Driver's championship position, normalised 0–1 |
| `constructor_champ_pos_norm` | Team's constructor championship position, normalised 0–1 |
| `team_race_pace_rank` | Team's avg finishing position over recent races (DNS/DSQ excluded) |
| `positions_gained_avg` | Average positions gained grid→finish over recent races (DNS/DSQ excluded) |
| `has_sprint` | 1 if sprint race data exists this weekend, 0 otherwise |
| `sprint_position` | Sprint race finishing position (NaN on non-sprint weekends) |
| `sprint_quali_delta` | Sprint position minus qualifying position (negative = gained positions) |
| `sprint_pace_delta_pct` | Sprint best lap vs session fastest, as % |
| `is_new_team` | 1 if driver joined this constructor mid-season |

### Model Details

All three models share similar hyperparameters: 300 estimators, learning rate 0.05, max depth 4–5. Training uses median imputation for missing values and sample weights that give 2026 race results 5× the weight of 2025 data to reflect the new regulations. Cross-validation uses 4-fold `TimeSeriesSplit` grouped by (season, round) to prevent temporal leakage.

| Model | Algorithm | Target | CV Accuracy |
|---|---|---|---|
| Win classifier | XGBoost | Race winner | 56.7% |
| Podium classifier | LightGBM | Top-3 finish | 62.2% |
| Position regressor | XGBoost | Final position | — |

Evaluated across 60 races (2023–2026 historical + 2026 season-to-date) using 4-fold TimeSeriesSplit.

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
