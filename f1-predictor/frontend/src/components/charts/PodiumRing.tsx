"use client";

import { motion } from "framer-motion";

interface PodiumRingProps {
  probability: number;
  teamColor: string;
  size?: number;
  delay?: number;
}

export default function PodiumRing({
  probability,
  teamColor,
  size = 40,
  delay = 0,
}: PodiumRingProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, probability);
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A2A2A"
          strokeWidth={3}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={teamColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, delay, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <span className="absolute font-barlow font-700 tabular-nums" style={{ fontSize: size * 0.26, color: "#E8E8E8" }}>
        {Math.round(probability * 100)}%
      </span>
    </div>
  );
}
