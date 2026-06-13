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
    desc: "Historical race results, qualifying positions, sprint race results, driver standings, and constructor standings from 2023 onwards. Used for both training and 2026 race result ingestion.",
    tag: "Historical",
  },
  {
    name: "OpenF1 API",
    url: "openf1.org",
    desc: "Real-time session data: practice lap times, sprint fastest laps, live race weather (temperature, rainfall). Used for pace delta features and race-day conditions once the session is live.",
    tag: "Real-time",
  },
  {
    name: "Open-Meteo",
    url: "open-meteo.com",
    desc: "Hourly weather forecast for the race location and start time. Used pre-race to estimate track temperature and rain probability when the session hasn't started yet. Track temp is derived from air temp and cloud cover.",
    tag: "Forecast",
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
    desc: "Driver's race-representative practice pace vs the session fastest, as a percentage. FP2 long-run stints (5+ consecutive clean laps) are used first — these reflect actual race conditions better than single-lap pace. Falls back to FP3 → FP2 → FP1 best lap when long runs aren't available. On sprint weekends, sprint race fastest laps are used instead.",
  },
  {
    name: "Tire Degradation Rate",
    weight: "Medium",
    desc: "How much a driver's lap time degrades per lap during FP2 long runs, expressed as % of median lap time per lap. Extracted from the same stints as Practice Pace Delta. Lower = better tire management. A key differentiator on circuits with high degradation (e.g. Barcelona) where 2-stop strategies are the norm.",
  },
  {
    name: "Circuit Historical Average",
    weight: "Medium",
    desc: "Driver's average finish at this circuit with their current team only (removes cross-team era contamination). Retired results are excluded. Exponentially weighted so recent visits count more.",
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
    desc: "Recency-weighted win rate and podium rate — recent seasons count more (2026 = 5×, 2025 = 1×, 2024 = 0.5×). Prevents historical dominance from inflating predictions when a team's form has dropped (e.g. McLaren's 2024 championship era doesn't distort 2026 predictions).",
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
    desc: "Is it raining (0/1) and track temperature at race start. Source priority: live OpenF1 session → Open-Meteo forecast (air temp + cloud cover estimate) → same-weekend session → default. Changes tyre behaviour and overtaking rates significantly.",
  },
  {
    name: "Team Reliability Score",
    weight: "Low",
    desc: "Constructor's DNF rate this season. DNS and DSQ events are excluded from both numerator and denominator — only actual race starts count toward reliability.",
  },
  {
    name: "Sprint Position",
    weight: "Low–Med",
    desc: "Finishing position in the sprint race. Only meaningful on sprint weekends — the has_sprint flag tells the model when this feature contains real data vs. imputed noise.",
  },
  {
    name: "Sprint Quali Delta",
    weight: "Low–Med",
    desc: "Sprint finishing position minus qualifying position. Negative = gained positions, so a driver with strong race pace relative to their quali pace scores negative here. One of the top-5 most important features on sprint weekends.",
  },
  {
    name: "Sprint Pace Delta",
    weight: "Low",
    desc: "Driver's best sprint lap vs session fastest, as a percentage. Captures outright race pace independent of grid position.",
  },
  {
    name: "Sprint Weekend Flag",
    weight: "Low",
    desc: "Binary 0/1 flag indicating whether the current weekend has a sprint race. Without this, the model can't distinguish real sprint data from median-imputed values, making sprint features noisy.",
  },
  {
    name: "Driver DNF Rate",
    weight: "Low",
    desc: "Driver's DNF rate over last 10 races. Penalises error-prone or crash-prone drivers.",
  },
  {
    name: "Circuit Positions Gained",
    weight: "Low–Med",
    desc: "Average positions gained from grid to finish specifically at this circuit, with current team only. Unlike the general positions-gained average, this captures circuit-specific race-craft — e.g. a driver who always holds position at Monaco vs one who charges through the field at Spa.",
  },
  {
    name: "Overtake Difficulty Index",
    weight: "Low",
    desc: "How easy it is to overtake at this circuit: higher = more overtaking opportunities (high-speed circuits like Spa/Monza score 0.8), lower = grid position is destiny (Monaco scores 0.05, Singapore 0.10). Per-circuit overrides take priority over the circuit-type default.",
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
    desc: "The model trains on 2022–2026 race results (~1,500 driver-race rows across 4+ seasons). This is a small dataset for ML — confidence intervals are wide, and the model is most reliable when qualifying position already tells a clear story.",
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
    title: "Sprint weekends underrepresented",
    desc: "There are only ~6 sprint weekends per season, so sprint features (position, pace delta, quali delta) have less training signal than their real-world value warrants. On sprint weekends the model carries higher uncertainty for drivers whose form diverges significantly between qualifying and sprint.",
  },
  {
    title: "No tyre strategy or race-day tactics",
    desc: "Compound choice at the start, undercut windows, safety car timing, and pit strategy calls are major race outcome drivers that aren't available pre-race and aren't modelled.",
  },
  {
    title: "Qualifying fallback for missing data",
    desc: "If qualifying data isn't available yet (pre-qualifying weekend), the model uses a driver's historical average grid position. If a driver makes Q3 but doesn't set a time (e.g. crashes on an out-lap), the model uses FP3 pace as a proxy instead of a coarse positional estimate. Both fallbacks are less accurate than actual qualifying results.",
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
          Box Box uses a machine learning ensemble trained on F1 race data from 2022 to present.
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
          All API responses are cached locally. Qualifying and sprint data refreshes every 48 hours; race results are cached permanently. Calendar and standings refresh every 6 hours. Weather forecasts refresh every 2 hours.
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
          Each row in the training dataset represents one driver in one race. 24 features are computed per driver.
          Features with no historical baseline fall back to field averages.
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
            Trained on ~1,500 driver-race rows across 2022–2026. Models are retrained as 2026 results accumulate.
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
