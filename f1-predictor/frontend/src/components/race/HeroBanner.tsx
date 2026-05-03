"use client";

import { motion } from "framer-motion";
import type { RacePrediction } from "@/lib/types";
import CountdownTimer from "@/components/ui/CountdownTimer";
import Pill from "@/components/ui/Pill";
import PredictionCard from "./PredictionCard";
import { useCountdown } from "@/hooks/useCountdown";

interface HeroBannerProps {
  data: RacePrediction;
  nextRaceDate?: string;
  nextRaceName?: string;
}

const FRESHNESS_LABELS: Record<string, string> = {
  "post-qualifying": "Post Qualifying",
  "post-fp": "Post Practice",
  "pre-weekend": "Pre-Weekend",
  "race-day": "Race Day",
};

// Simplified circuit outlines keyed by circuit name from predictions.json
const CIRCUIT_PATHS: Record<string, string> = {
  "Miami International Autodrome":
    "M 68,250 L 68,55 C 68,28 105,18 135,36 L 176,43 C 195,38 210,50 210,50 L 300,50 C 335,50 342,80 340,108 L 340,192 C 340,220 322,232 300,238 L 278,244 C 260,250 250,237 248,222 C 246,208 258,202 270,208 C 282,214 284,228 272,236 L 254,242 C 236,248 224,236 222,222 C 220,208 232,202 244,208 C 254,213 256,226 246,234 L 228,240 C 210,246 198,234 196,220 C 194,207 204,200 215,205 C 225,210 226,224 217,230 L 205,236 C 188,244 168,244 148,246 L 112,250 C 92,252 75,252 68,250 Z",
  // Generic fallback used for circuits without a dedicated path
  _fallback:
    "M50 250 C50 250 80 200 120 180 L180 160 C220 140 240 100 280 80 C320 60 360 80 380 120 L380 180 C380 220 340 240 300 240 L200 240 C160 240 140 260 120 280 L80 280 C60 280 50 265 50 250Z",
};

export default function HeroBanner({ data, nextRaceDate, nextRaceName }: HeroBannerProps) {
  const top3 = data.predictions.slice(0, 3);
  const pole = top3.find((p) => p.quali_position === 1) ?? top3[0];
  const { isPast, isLive } = useCountdown(data.race_date);
  const showingNextRace = isPast && !isLive && !!nextRaceDate;

  return (
    <section className="relative overflow-hidden bg-carbon border-b border-border">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${top3[0]?.team_color ?? "#E10600"}, transparent)`,
        }}
      />

      {/* Circuit silhouette decoration */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.04] hidden lg:block">
        <svg viewBox="0 0 400 300" className="w-full h-full" fill="none">
          <path
            d={CIRCUIT_PATHS[data.circuit] ?? CIRCUIT_PATHS._fallback}
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Round badge + freshness */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center gap-2 mb-4"
        >
          <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest border border-border px-2 py-1 rounded-sm">
            RD {String(data.round).padStart(2, "0")} · {data.season}
          </span>
          <Pill
            label={FRESHNESS_LABELS[data.data_freshness] ?? data.data_freshness}
            variant={data.data_freshness as any}
          />
          {data.model_source === "heuristic" && (
            <Pill label="Heuristic Model" variant="neutral" />
          )}
        </motion.div>

        {/* Race name */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-barlow font-900 text-4xl sm:text-5xl lg:text-7xl uppercase tracking-tight text-platinum leading-none mb-2"
        >
          {data.race.replace(" Grand Prix", "")}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="font-barlow font-600 text-lg text-muted uppercase tracking-widest mb-6"
        >
          {data.circuit}
        </motion.p>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10"
        >
          <p className="font-barlow font-600 text-xs text-muted uppercase tracking-widest mb-2">
            {showingNextRace ? `Next Race · ${nextRaceName?.replace(" Grand Prix", "")}` : "Race Start"}
          </p>
          <CountdownTimer
            raceDate={data.race_date}
            nextRaceDate={nextRaceDate}
            nextRaceName={nextRaceName}
          />
        </motion.div>

        {/* Top 3 prediction cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
          {top3.map((prediction, i) => (
            <motion.div
              key={prediction.driver_code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              className="h-full"
            >
              <PredictionCard prediction={prediction} rank={i + 1} delay={0.3 + i * 0.1} />
            </motion.div>
          ))}
        </div>

        {/* Pole position indicator */}
        {data.data_freshness === "post-qualifying" && pole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 flex items-center gap-2"
          >
            <span className="font-barlow font-600 text-xs text-muted uppercase tracking-widest">
              Pole Position:
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: pole.team_color }}
              />
              <span className="font-barlow font-700 text-sm text-platinum">
                {pole.driver_name}
              </span>
              <span className="font-inter text-xs text-muted">{pole.team}</span>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
