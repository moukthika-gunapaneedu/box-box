"use client";

import { motion } from "framer-motion";
import type { DriverPrediction } from "@/lib/types";
import WinProbabilityBar from "@/components/charts/WinProbabilityBar";
import PodiumRing from "@/components/charts/PodiumRing";
import Pill from "@/components/ui/Pill";
import Tooltip from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

const CONFIDENCE_TOOLTIPS: Record<string, string> = {
  high: "Strong prediction: pole or front-row start with high win probability.",
  medium: "Moderate signals: top-6 grid or solid win/podium probability.",
  low: "Limited signals — prediction based mainly on historical data.",
};

interface PredictionCardProps {
  prediction: DriverPrediction;
  rank: number;
  delay?: number;
}

const RANK_STYLES: Record<number, { border: string; label: string; labelColor: string }> = {
  1: { border: "#FFD700", label: "P1", labelColor: "#FFD700" },
  2: { border: "#C0C0C0", label: "P2", labelColor: "#C0C0C0" },
  3: { border: "#CD7F32", label: "P3", labelColor: "#CD7F32" },
};

export default function PredictionCard({ prediction: p, rank, delay = 0 }: PredictionCardProps) {
  const rankStyle = RANK_STYLES[rank];

  return (
    <div
      className="relative glass-card overflow-hidden transition-all duration-300 hover:border-opacity-50 group"
      style={{
        borderLeftColor: rankStyle?.border ?? p.team_color,
        borderLeftWidth: 3,
      }}
    >
      {/* Team color glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at left, ${p.team_color}08, transparent 70%)` }}
      />

      <div className="relative p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {rankStyle && (
                <span
                  className="font-barlow font-900 text-sm"
                  style={{ color: rankStyle.labelColor }}
                >
                  {rankStyle.label}
                </span>
              )}
              <span className="font-barlow font-900 text-xl uppercase tracking-tight text-platinum">
                {p.driver_name.split(" ").pop()}
              </span>
            </div>
            <p className="font-inter text-xs text-muted">{p.team}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Tooltip text="Chance of finishing in the top 3 (P1, P2, or P3)." position="top">
              <PodiumRing probability={p.podium_probability} teamColor={p.team_color} size={44} delay={delay} />
            </Tooltip>
            <span className="font-inter text-[10px] text-muted">Podium %</span>
          </div>
        </div>

        {/* Win probability bar */}
        <div className="mb-3">
          <Tooltip text="Likelihood this driver wins the race. All 20 drivers combined = 100%." position="top">
            <p className="font-barlow font-600 text-xs text-muted uppercase tracking-widest mb-1.5 cursor-default">
              Win Probability
            </p>
          </Tooltip>
          <WinProbabilityBar
            probability={p.win_probability}
            teamColor={p.team_color}
            delay={delay + 0.2}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Tooltip text={CONFIDENCE_TOOLTIPS[p.confidence]} position="bottom">
            <Pill
              label={p.confidence.toUpperCase()}
              variant={p.confidence}
            />
          </Tooltip>
          <Tooltip text="Starting grid position from qualifying." position="bottom">
            <span className="font-barlow font-600 text-xs text-muted cursor-default">
              Grid P{p.quali_position}
            </span>
          </Tooltip>
        </div>

        {/* Key factors */}
        {p.key_factors.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            {p.key_factors.slice(0, 2).map((factor, i) => (
              <p key={i} className="font-inter text-[11px] text-muted italic">
                · {factor}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
