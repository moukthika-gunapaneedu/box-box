"use client";

import { motion } from "framer-motion";
import { formatProbability } from "@/lib/utils";

interface WinProbabilityBarProps {
  probability: number;
  teamColor: string;
  delay?: number;
  showLabel?: boolean;
  height?: number;
}

export default function WinProbabilityBar({
  probability,
  teamColor,
  delay = 0,
  showLabel = true,
  height = 6,
}: WinProbabilityBarProps) {
  const pct = Math.min(100, probability * 100);

  return (
    <div className="flex items-center gap-2 w-full">
      <div
        className="flex-1 rounded-sm overflow-hidden"
        style={{ height, background: "#2A2A2A" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay, ease: [0.4, 0, 0.2, 1] }}
          style={{ height: "100%", background: teamColor, borderRadius: 2 }}
        />
      </div>
      {showLabel && (
        <span className="font-barlow font-700 tabular-nums text-sm text-platinum min-w-[3rem] text-right">
          {formatProbability(probability)}
        </span>
      )}
    </div>
  );
}
