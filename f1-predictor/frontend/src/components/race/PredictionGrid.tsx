"use client";

import { motion } from "framer-motion";
import type { DriverPrediction } from "@/lib/types";
import WinProbabilityBar from "@/components/charts/WinProbabilityBar";
import PodiumRing from "@/components/charts/PodiumRing";
import Pill from "@/components/ui/Pill";
import { formatProbability } from "@/lib/utils";

interface PredictionGridProps {
  predictions: DriverPrediction[];
}

const POSITION_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const row = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
};

export default function PredictionGrid({ predictions }: PredictionGridProps) {
  return (
    <div className="w-full">
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[3rem_1fr_160px_140px_100px_100px] gap-3 px-4 py-2 border-b border-border mb-1">
        {["POS", "DRIVER", "WIN %", "PODIUM %", "GRID", "CONFIDENCE"].map((h) => (
          <span key={h} className="font-barlow font-700 text-xs text-muted uppercase tracking-widest">
            {h}
          </span>
        ))}
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-1"
      >
        {predictions.slice(0, 10).map((p, i) => {
          const posColor = POSITION_COLORS[p.position];
          return (
            <motion.div
              key={p.driver_code}
              variants={row}
              className="group relative glass-card overflow-hidden transition-all duration-200 hover:bg-surface-2"
              style={{ borderLeftColor: p.team_color, borderLeftWidth: 2 }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at left, ${p.team_color}06, transparent 60%)` }}
              />

              {/* Desktop layout */}
              <div className="hidden md:grid grid-cols-[3rem_1fr_160px_140px_100px_100px] gap-3 items-center px-4 py-3">
                {/* Position */}
                <span
                  className="font-barlow font-900 text-lg tabular-nums"
                  style={{ color: posColor ?? "#888888" }}
                >
                  {String(p.position).padStart(2, "0")}
                </span>

                {/* Driver */}
                <div>
                  <p className="font-barlow font-700 text-base text-platinum uppercase tracking-tight">
                    {p.driver_name}
                  </p>
                  <p className="font-inter text-xs text-muted">{p.team}</p>
                </div>

                {/* Win % bar */}
                <WinProbabilityBar
                  probability={p.win_probability}
                  teamColor={p.team_color}
                  delay={i * 0.04}
                  height={5}
                />

                {/* Podium ring + % */}
                <div className="flex items-center gap-2">
                  <PodiumRing
                    probability={p.podium_probability}
                    teamColor={p.team_color}
                    size={36}
                    delay={i * 0.04}
                  />
                </div>

                {/* Grid position */}
                <span className="font-barlow font-700 text-sm text-muted tabular-nums">
                  P{p.quali_position}
                </span>

                {/* Confidence */}
                <Pill label={p.confidence.toUpperCase()} variant={p.confidence} />
              </div>

              {/* Mobile layout */}
              <div className="md:hidden p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="font-barlow font-900 text-2xl tabular-nums w-8"
                      style={{ color: posColor ?? "#888888" }}
                    >
                      {p.position}
                    </span>
                    <div>
                      <p className="font-barlow font-700 text-sm text-platinum uppercase">{p.driver_name}</p>
                      <p className="font-inter text-xs text-muted">{p.team}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill label={p.confidence.toUpperCase()} variant={p.confidence} />
                    <span className="font-barlow font-700 text-xs text-muted">P{p.quali_position}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-barlow text-xs text-muted uppercase tracking-widest mb-1">Win %</p>
                    <WinProbabilityBar
                      probability={p.win_probability}
                      teamColor={p.team_color}
                      delay={i * 0.04}
                      height={4}
                    />
                  </div>
                  <div className="text-right">
                    <p className="font-barlow text-xs text-muted uppercase tracking-widest mb-1">Podium</p>
                    <span className="font-barlow font-700 text-sm" style={{ color: p.team_color }}>
                      {formatProbability(p.podium_probability)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
