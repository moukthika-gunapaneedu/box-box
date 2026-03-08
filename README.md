# box-box

![box-box](./box-box.jpg)

> *"Box, box."* - your race engineer, probably.

An AI-powered Formula 1 race prediction platform for the 2026 season. Box-box combines real-time qualifying data, practice pace, historical performance, and machine learning to predict race winners, podium finishes, and driver positions — before lights out.

---

## Features

- **Three-model ensemble** — XGBoost win classifier, LightGBM podium classifier, XGBoost position regressor
- **Live data integration** — qualifying results, practice pace, and pit stop data from OpenF1 and Jolpica/Ergast APIs
- **Advanced feature engineering** — grid position, 5-race rolling form, team pace ranking, circuit-specific performance, overtaking tendency, and reliability scores
- **Confidence scoring** — High/Medium/Low confidence with human-readable factors ("Starting from pole", "Excellent recent form")
- **Season accuracy tracking** — compares predictions against actual results after every race
- **Automatic retraining** — models update as 2026 race results come in
- **CI/CD deployment** — push to `main` and GitHub Actions builds and deploys to GitHub Pages

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, Recharts, Framer Motion, Radix UI |
| Backend | Python, XGBoost, LightGBM, scikit-learn, FastF1 |
| Data | OpenF1 API, Jolpica (Ergast replacement) |
| Deploy | GitHub Pages + GitHub Actions |

---

## Project Structure

```
box-box/
└── f1-predictor/
    ├── backend/
    │   ├── scripts/
    │   │   ├── collect_data.py        # Fetch from OpenF1 & Jolpica APIs
    │   │   ├── feature_engineer.py    # Build feature matrices
    │   │   ├── train_model.py         # Train XGBoost + LightGBM ensemble
    │   │   ├── predict_race.py        # Generate race predictions
    │   │   ├── update_history.py      # Track post-race accuracy
    │   │   └── utils.py               # Driver info, team colors, circuit data
    │   ├── models/
    │   │   ├── xgb_win.pkl            # XGBoost winner classifier
    │   │   ├── lgb_podium.pkl         # LightGBM podium classifier
    │   │   ├── xgb_position.pkl       # XGBoost position regressor
    │   │   └── metrics.json           # Model accuracy metrics
    │   ├── data/
    │   │   ├── cache/                 # API response cache
    │   │   └── training_features.parquet
    │   └── requirements.txt
    └── frontend/
        └── src/
            ├── app/                   # Pages: home, drivers, races, model
            ├── components/            # Race cards, charts, layout
            ├── hooks/                 # Custom React hooks
            └── lib/                   # Types, utilities, data loading
```

---

## How It Works

1. **Pre-race** — backend fetches live qualifying and practice data, builds features, and runs all three models to generate probability scores
2. **Predictions published** — output is written to static JSON files served by the frontend
3. **Post-race** — actual results are recorded, compared against predictions, and accuracy metrics are updated
4. **Retrain** — new race data is folded into the training set and models are updated

Models are trained on 2023–2025 historical data using `TimeSeriesSplit` cross-validation to prevent data leakage. Current accuracy: ~51.8% winner, ~64.3% podium across 56 races.

---

## Getting Started

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

python scripts/train_model.py          # Train models on historical data
python scripts/predict_race.py         # Predict current race (auto-detects round)
python scripts/predict_race.py 5       # Predict a specific round
python scripts/update_history.py       # Record actual results + update accuracy
```

---

## Deployment

Push to `main` — GitHub Actions handles the rest. The frontend exports to static HTML/CSS/JS and is deployed to GitHub Pages automatically.
