import { Database, Cpu, FlaskConical, AlertTriangle, TrendingUp, Zap, XCircle } from "lucide-react";
import { getMetricsStatic } from "@/lib/data";

export const metadata = {
  title: "How It Works | Box Box",
  description: "The ML model behind F1 race winner predictions — data sources, features, architecture, and known limitations.",
};

const DATA_SOURCES = [
  {
    name: "Jolpica / Ergast",
    url: "api.jolpi.ca",
    desc: "Historical race results, qualifying positions, driver standings, and constructor standings from 2023–2025. Core training data source.",
    tag: "Historical",
  },
  {
    name: "OpenF1 API",
    url: "openf1.org",
    desc: "Real-time session data for the current season: practice lap times, qualifying results, race weather (temperature, rainfall). Primary source for 2026 data.",
    tag: "Real-time",
  },
];

const FEATURES = [
  {
    name: "Qualifying Position",
    weight: "High",
    desc: "Actual grid position from qualifying. If a driver crashed or was excluded, they're assigned last place.",
  },
  {
    name: "Qualifying Gap to Pole %",
    weight: "High",
    desc: "Driver's best qualifying time as a % behind pole. More meaningful than raw lap time across different circuits.",
  },
  {
    name: "Recent Form (5-race avg)",
    weight: "Medium",
    desc: "Average finishing position over the last 5 races. Captures current momentum regardless of which team they're on.",
  },
  {
    name: "Team Race Pace Rank",
    weight: "Medium",
    desc: "Constructor's average finishing position over recent races, exponentially weighted so the latest races count more.",
  },
  {
    name: "Practice Pace Delta",
    weight: "Medium",
    desc: "Driver's best FP3 (or FP2) lap vs the session fastest, as a percentage. Proxy for race weekend setup and raw pace.",
  },
  {
    name: "Circuit Historical Average",
    weight: "Medium",
    desc: "Driver's average finishing position at this specific circuit across all training seasons.",
  },
  {
    name: "Positions Gained Average",
    weight: "Medium",
    desc: "Average positions gained from grid to finish over recent races. Captures race-craft vs pure qualifying pace.",
  },
  {
    name: "Championship Standing",
    weight: "Medium",
    desc: "Driver's normalised championship position and points from the prior round. Reflects current-season competitive order.",
  },
  {
    name: "Career Win & Podium Rate",
    weight: "Medium",
    desc: "All-time win rate and podium rate from training data. Helps correctly rank drivers who recently changed teams (e.g., Hamilton to Ferrari).",
  },
  {
    name: "Constructor Championship Pos.",
    weight: "Low–Med",
    desc: "Team's normalised constructor standing. Independent signal for overall car performance.",
  },
  {
    name: "Recent Season Avg Position",
    weight: "Low–Med",
    desc: "Driver's average finish in their most recent complete season. Reflects current car, not career average.",
  },
  {
    name: "Race Weather",
    weight: "Contextual",
    desc: "Is it raining (0/1) and track temperature at race start, from OpenF1. Changes tyre behaviour and overtaking rates significantly.",
  },
  {
    name: "Team Reliability Score",
    weight: "Low",
    desc: "Constructor's DNF rate this season. Penalises teams with recent mechanical failures.",
  },
  {
    name: "Driver DNF Rate",
    weight: "Low",
    desc: "Driver's DNF rate over last 10 races. Penalises error-prone or crash-prone drivers.",
  },
  {
    name: "Overtake Difficulty Index",
    weight: "Low",
    desc: "Circuit-type index: street circuits score high (hard to overtake), high-speed circuits score low.",
  },
];

const WEIGHT_COLORS: Record<string, string> = {
  High: "#E10600",
  Medium: "#FF8000",
  "Low–Med": "#FFD700",
  Contextual: "#00D2FF",
  Low: "#888888",
};

const LIMITATIONS = [
  {
    title: "Limited training data",
    desc: "The model trains on 2023–2026 race results. 2022 was dropped because it was the first year of ground-effect regulations and taught incorrect patterns. Even with 4 seasons (~1,400 driver-race rows), this is a small dataset for ML — confidence intervals are wide.",
  },
  {
    title: "2026 is an entirely new formula",
    desc: "New aerodynamic and power unit regulations mean 2026 cars behave differently from anything in the 2023–2025 training data. The model now incorporates 2026 results as they arrive (weighted 5× more than 2025), but the first few races carry high uncertainty until the new competitive order stabilises.",
  },
  {
    title: "New driver and team combinations",
    desc: "Hamilton moved to Ferrari, Antonelli replaced him at Mercedes, Cadillac is brand new. The model relies on career stats and constructor standings when team-specific history is thin — some drivers are inherently more uncertain than others.",
  },
  {
    title: "Mechanical failures and incidents are unpredictable",
    desc: "The model cannot predict Q1 crashes, rear-axle failures, or race-day retirements. Verstappen starting P20 in Australia after a Q1 crash is a perfect example — no historical feature could foresee that outcome.",
  },
  {
    title: "No tyre strategy or race-day tactics",
    desc: "Compound choice at the start, undercut windows, safety car timing, and pit strategy calls are major race outcome drivers that aren't available pre-race and aren't modelled.",
  },
  {
    title: "Qualifying fallback for missing data",
    desc: "If qualifying data isn't available from the API yet (pre-qualifying weekend), the model uses a driver's historical average grid position. This is less accurate than actual qualifying results and can significantly skew predictions.",
  },
];

export default async function ModelPage() {
  const metrics = await getMetricsStatic();

  const winnerAccStr = metrics ? `${(metrics.winner_accuracy * 100).toFixed(1)}%` : "—";
  const podiumAccStr = metrics ? `${(metrics.podium_accuracy * 100).toFixed(1)}%` : "—";
  const racesEval = metrics?.total_races_evaluated ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest">Transparency</span>
        <h1 className="font-barlow font-900 text-4xl sm:text-5xl uppercase tracking-tight text-platinum mt-2 mb-4">
          How It Works
        </h1>
        <p className="font-inter text-sm text-muted leading-relaxed max-w-2xl">
          Box Box uses a machine learning ensemble trained on F1 race data from 2023 to present.
          Predictions are regenerated after qualifying each Saturday using the actual grid positions.
        </p>
      </div>

      {/* 2026 caveat */}
      <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5 mb-10 flex gap-3">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-barlow font-700 text-sm text-amber-400 uppercase tracking-wide mb-1">
            2026 Season — New Formula
          </p>
          <p className="font-inter text-xs text-muted leading-relaxed">
            2026 introduces new aerodynamic and power unit regulations — essentially a new formula.
            The model now trains on 2026 race results as they come in, weighted 5× more heavily than 2025 data.
            Early-season predictions carry higher uncertainty until the new competitive order becomes clear.
          </p>
        </div>
      </div>

      {/* Data sources */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <Database size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Data Sources</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DATA_SOURCES.map((src) => (
            <div key={src.name} className="glass-card p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-barlow font-700 text-sm text-platinum uppercase tracking-wide">{src.name}</h3>
                <span className="font-barlow font-600 text-xs text-muted border border-border px-1.5 py-0.5 rounded-sm">
                  {src.tag}
                </span>
              </div>
              <p className="font-inter text-xs text-muted leading-relaxed mb-2">{src.desc}</p>
              <span className="font-inter text-[10px] text-muted/60">{src.url}</span>
            </div>
          ))}
        </div>
        <p className="font-inter text-xs text-muted mt-3 pl-1">
          All API responses are cached locally. Qualifying data refreshes every 48 hours; race results are cached permanently. Calendar and standings refresh every 6 hours.
        </p>
      </section>

      {/* Features */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <FlaskConical size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Feature Engineering</h2>
        </div>
        <p className="font-inter text-xs text-muted mb-4 leading-relaxed">
          Each row in the training dataset represents one driver in one race. 15 features are computed per driver.
          Features with no historical baseline fall back to field averages.
          Three features that were tested and added no predictive value (circuit chaos rate, teammate finish gap, new-team flag) were removed.
        </p>
        <div className="space-y-1">
          {FEATURES.map((feat) => (
            <div key={feat.name} className="glass-card p-3 flex items-start gap-4 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-2 w-28 shrink-0">
                <div
                  className="w-1 min-h-[24px] rounded-full shrink-0 self-stretch"
                  style={{ background: WEIGHT_COLORS[feat.weight] ?? "#888" }}
                />
                <span
                  className="font-barlow font-700 text-xs uppercase tracking-wide"
                  style={{ color: WEIGHT_COLORS[feat.weight] ?? "#888" }}
                >
                  {feat.weight}
                </span>
              </div>
              <div>
                <p className="font-barlow font-700 text-sm text-platinum uppercase tracking-wide">{feat.name}</p>
                <p className="font-inter text-xs text-muted">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Model architecture */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <Cpu size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Model Architecture</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            {
              name: "XGBoost Win",
              type: "Classifier",
              target: "Win probability",
              desc: "Binary classifier (position = 1). Uses scale_pos_weight to handle class imbalance — only 1 in 20 drivers wins per race.",
            },
            {
              name: "LightGBM Podium",
              type: "Classifier",
              target: "Top-3 probability",
              desc: "Gradient boosting with is_unbalance=True. Trained independently from the win model. Output is normalised so all drivers' podium probabilities sum to 3.0.",
            },
            {
              name: "XGBoost Position",
              type: "Regressor",
              target: "Predicted finish",
              desc: "Regression model for full grid ordering. Resolves ties in probability output and determines predicted finishing rank.",
            },
          ].map((m) => (
            <div key={m.name} className="glass-card p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-barlow font-800 text-base text-platinum uppercase">{m.name}</h3>
                <span className="font-barlow text-xs text-f1-red border border-f1-red/30 px-1.5 py-0.5 rounded-sm">
                  {m.type}
                </span>
              </div>
              <p className="font-barlow font-600 text-xs text-muted uppercase tracking-widest mb-2">{m.target}</p>
              <p className="font-inter text-xs text-muted leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
        <div className="glass-card p-4 flex gap-3">
          <Zap size={14} className="text-muted shrink-0 mt-0.5" />
          <p className="font-inter text-xs text-muted leading-relaxed">
            <span className="text-platinum font-500">Training: </span>
            TimeSeriesSplit cross-validation (4 folds) ensures the model is never trained on future race data — no leakage.
            Season weights: 2026 races are weighted 5× more than 2025, which is weighted 2× more than 2024.
            Trained on ~1,400 driver-race rows across 2023–2026. Models are retrained as 2026 results accumulate.
          </p>
        </div>
      </section>

      {/* Accuracy */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <TrendingUp size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Accuracy</h2>
        </div>
        <div className="glass-card p-5 space-y-4 mb-3">
          {[
            {
              label: "Random baseline",
              value: "5%",
              desc: "Picking any driver from a 20-car grid at random wins 5% of the time.",
            },
            {
              label: "Pole position baseline",
              value: "~30%",
              desc: "Historically, the pole-sitter converts to a race win about 30% of the time.",
            },
            {
              label: "CV winner accuracy",
              value: winnerAccStr,
              desc: `Measured via TimeSeriesSplit on ${racesEval} historical races. The model correctly picks the race winner in roughly 1 in 2 races — ~10× better than random.`,
            },
            {
              label: "CV podium accuracy",
              value: podiumAccStr,
              desc: `Average overlap between predicted top-3 and actual top-3. Measured across the same ${racesEval} races.`,
            },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between border-b border-border pb-4 last:border-0 last:pb-0">
              <div>
                <p className="font-barlow font-700 text-sm text-platinum uppercase tracking-wide">{row.label}</p>
                <p className="font-inter text-xs text-muted">{row.desc}</p>
              </div>
              <span className="font-barlow font-900 text-xl text-f1-red tabular-nums ml-4 shrink-0">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="font-inter text-xs text-muted pl-1">
          CV figures are from cross-validation on 2023–2025 data. Live 2026 accuracy is tracked on the home page as each race result comes in.
        </p>
      </section>

      {/* Limitations */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <XCircle size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Known Limitations</h2>
        </div>
        <div className="space-y-2">
          {LIMITATIONS.map((lim) => (
            <div key={lim.title} className="glass-card p-4 flex gap-3">
              <div className="w-1 shrink-0 rounded-full bg-amber-500/40 self-stretch" />
              <div>
                <p className="font-barlow font-700 text-sm text-platinum uppercase tracking-wide mb-1">{lim.title}</p>
                <p className="font-inter text-xs text-muted leading-relaxed">{lim.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
