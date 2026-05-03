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

// Circuit outlines: path + viewBox keyed by circuit name from predictions.json
const CIRCUIT_PATHS: Record<string, { d: string; viewBox: string }> = {
  "Miami International Autodrome": {
    viewBox: "0 0 794.1 434",
    d: "M316.8,101.5c15.4,9.2,159,93,165.6,97c8.1,5,10.4,9.9,10.4,14.7c0,3.6-4.3,10.7-12.4,15.1c-8.1,4.4-17.8,9.4-18.7,18.9s4.6,34.7-8.3,45c-13,10.3-28.3,22.8-69.8,22.8c-16.9,0-43.5-11.2-57.5-19.5c-14-8.3-76.4-44.8-83-48.3s-14.7-6.6-23-6.4s-21.7,4.6-30.3,11.2c-8.6,6.6-17.8,13.2-34.2,13.2c-13.8,0-26.1-14.3-29.2-17.8c-3.1-3.5-15.4-15.1-30.5-15.1s-34.2,5.9-43,14c-8.8,8.1-14.9,14.3-14.9,31.4s14.5,20.4,23.3,20.4c5.9,0,13-2,29.6-2s41.7,13.6,69.6,13.6S285,308,292.6,308c7.7,0,22.4,1.3,36.7,7c14.3,5.7,51.8,27,99.2,27c16.7,0,48.5-1.5,65.9-6.4s101-33.8,114.4-38.9c4.2-1.6,36.5-15.3,64.1-29c22.2-11,31.9-15.2,41.5-22.4c2.9-2.2,4.8-4.1,4.8-7.9s-5.2-6.4-7.6-8.1c-2.4-1.7-12.8-7.8-15.8-9.8c-3-2-11.2-7.4-11.2-19c0-11.6,7.4-21.4,19.5-21.4s19.1,0,22.9,0s11.6,0.8,18.4-8.6s10.6-15.7,11.1-17.4s1.9-5-0.9-6.8c-2.8-1.8-5.3-3.4-6.1-3.9s-2.5-2.7-1.3-7.8c1.2-5.1,6.7-23.3,7.1-26.9c0.4-3.6,1.2-10.9-6.2-11c-7.4-0.1-472.7-18.4-493.1-19.3c-20.4-0.9-117.2-4.6-122.5-4.6s-10.2,2-10.2,8.4c0,6.4,3.4,8.3,6.3,10.7c2.9,2.4,26,17.6,28.8,19.5s8.4,4.8,16,4.8c4.2,0,6.8,0,9.2,0c7.1,0,14.1-2.8,19.2-5.3c5.1-2.5,31.6-15.8,36.9-18c5.3-2.2,12.6-2.9,20.3-2.9c7.7,0,18.4,0,23.2,0s17,2.8,22.1,5.3S316.8,101.5,316.8,101.5z",
  },
  _fallback: {
    viewBox: "0 0 400 300",
    d: "M50 250 C50 250 80 200 120 180 L180 160 C220 140 240 100 280 80 C320 60 360 80 380 120 L380 180 C380 220 340 240 300 240 L200 240 C160 240 140 260 120 280 L80 280 C60 280 50 265 50 250Z",
  },
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
      {(() => {
        const circuit = CIRCUIT_PATHS[data.circuit] ?? CIRCUIT_PATHS._fallback;
        return (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.06] hidden lg:block">
            <svg viewBox={circuit.viewBox} className="w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
              <path
                d={circuit.d}
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        );
      })()}

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
