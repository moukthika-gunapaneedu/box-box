import { Database, Cpu, FlaskConical, AlertTriangle, TrendingUp, Zap } from "lucide-react";

export const metadata = {
  title: "How It Works | F1 Predictor",
  description: "The ML model behind F1 race winner predictions — data sources, features, and architecture.",
};

const DATA_SOURCES = [
  {
    name: "OpenF1 API",
    url: "openf1.org",
    desc: "Real-time session data: lap times, sector times, pit stops, weather, car telemetry. Primary source for 2026 season.",
    tag: "Real-time",
  },
  {
    name: "Jolpica / Ergast",
    url: "api.jolpi.ca",
    desc: "Historical race results, qualifying, and standings from 2022–2025. Used to build driver and circuit profiles.",
    tag: "Historical",
  },
  {
    name: "OpenMeteo",
    url: "open-meteo.com",
    desc: "Race weekend weather forecasts: temperature, rainfall, wind. Used as a feature for wet/dry performance delta.",
    tag: "Weather",
  },
];

const FEATURES = [
  { name: "Qualifying Position", weight: "High", desc: "Strongest single predictor. Grid position determines overtaking opportunity." },
  { name: "Qualifying Gap to Pole %", weight: "High", desc: "Pace delta as % of pole time. Better than raw time difference across circuits." },
  { name: "Recent Form (5-race avg)", weight: "Medium", desc: "Rolling average finishing position over last 5 races. Captures momentum." },
  { name: "FP Pace Delta", weight: "Medium", desc: "Practice session best lap vs session fastest. Proxy for race pace." },
  { name: "Circuit Historical Avg", weight: "Medium", desc: "Driver's average finish at this specific circuit. Circuit-driver affinity." },
  { name: "Team Reliability Score", weight: "Low-Med", desc: "Constructor DNF rate this season. High reliability = consistent finishing." },
  { name: "Driver DNF Rate", weight: "Low", desc: "Rolling 10-race DNF rate. Penalizes error-prone drivers." },
  { name: "Overtake Difficulty", weight: "Low", desc: "Circuit type index: street = hard to overtake, high-speed = easier." },
];

const WEIGHT_COLORS: Record<string, string> = {
  High: "#E10600",
  "Medium": "#FF8000",
  "Low-Med": "#FFD700",
  "Low": "#888888",
};

export default function ModelPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest">Transparency</span>
        <h1 className="font-barlow font-900 text-4xl sm:text-5xl uppercase tracking-tight text-platinum mt-2 mb-4">
          How It Works
        </h1>
        <p className="font-inter text-sm text-muted leading-relaxed max-w-2xl">
          F1 Predictor uses a machine learning ensemble trained on race data from 2022 to present.
          Predictions update automatically after qualifying and on race morning via GitHub Actions.
        </p>
      </div>

      {/* 2026 caveat */}
      <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5 mb-10 flex gap-3">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-barlow font-700 text-sm text-amber-400 uppercase tracking-wide mb-1">
            2026 Regulation Note
          </p>
          <p className="font-inter text-xs text-muted leading-relaxed">
            2026 introduces entirely new aerodynamic and power unit regulations — essentially a new formula.
            Pre-2026 data is down-weighted (5× weighting on 2026 races vs 1× for 2025).
            Early-season predictions carry more uncertainty until the competitive order becomes clear.
            Cadillac F1 has no historical race data and is modelled using driver backgrounds + practice pace only.
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </section>

      {/* Features */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <FlaskConical size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Feature Engineering</h2>
        </div>
        <div className="space-y-1">
          {FEATURES.map((feat) => (
            <div key={feat.name} className="glass-card p-3 flex items-start gap-4 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-2 w-28 shrink-0">
                <div
                  className="w-1 h-full min-h-[24px] rounded-full shrink-0"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              name: "XGBoost Win",
              type: "Classifier",
              target: "Win probability",
              desc: "Binary classifier with class imbalance correction (scale_pos_weight). Primary model.",
            },
            {
              name: "LightGBM Podium",
              type: "Classifier",
              target: "Top-3 probability",
              desc: "Gradient boosting with is_unbalance=True. Captures podium likelihood independently.",
            },
            {
              name: "XGBoost Position",
              type: "Regressor",
              target: "Predicted finish",
              desc: "Regression model for full grid ordering. Used to resolve ties in the probability output.",
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
        <div className="mt-3 glass-card p-4 flex gap-3">
          <Zap size={14} className="text-muted shrink-0 mt-0.5" />
          <p className="font-inter text-xs text-muted leading-relaxed">
            <span className="text-platinum font-500">Training:</span> TimeSeriesSplit cross-validation (4 folds) ensures
            the model is never trained on future race data. Sample weights boost 2026 races 5× vs 2025, 10× vs 2024.
            Models are retrained automatically every 4 completed races.
          </p>
        </div>
      </section>

      {/* Accuracy context */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
            <TrendingUp size={16} className="text-muted" />
          </div>
          <h2 className="font-barlow font-800 text-xl uppercase tracking-wide text-platinum">Accuracy Context</h2>
        </div>
        <div className="glass-card p-5 space-y-4">
          {[
            { label: "Random baseline", value: "5%", desc: "Picking a random driver from 20 wins 5% of the time." },
            { label: "Qualifying baseline", value: "~30%", desc: "Pole position converts to win roughly 30% of the time historically." },
            { label: "Our target (post-qual)", value: "55-65%", desc: "With qualifying data, the model targets this range based on 2022-2025 backtesting." },
            { label: "Pre-weekend accuracy", value: "35-45%", desc: "Without qualifying data, accuracy drops significantly — more uncertainty." },
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
      </section>
    </div>
  );
}
