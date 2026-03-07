"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HistoryData } from "@/lib/types";

interface AccuracyChartProps {
  history: HistoryData;
}

export default function AccuracyChart({ history }: AccuracyChartProps) {
  if (!history.results.length) {
    return (
      <div className="flex items-center justify-center h-48 glass-card">
        <p className="font-inter text-muted text-sm">
          No race data yet — accuracy tracked from Round 1.
        </p>
      </div>
    );
  }

  // Build cumulative accuracy per round
  const data = history.results.map((r, i) => {
    const slice = history.results.slice(0, i + 1);
    const winAcc = slice.filter((x) => x.correct_win).length / slice.length;
    const podiumAcc = slice.reduce((sum, x) => sum + x.podium_hits, 0) / (slice.length * 3);
    return {
      round: `R${r.round}`,
      raceName: r.race,
      winAcc: Math.round(winAcc * 100),
      podiumAcc: Math.round(podiumAcc * 100),
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const race = data.find((d) => d.round === label);
      return (
        <div className="glass-card p-3 min-w-[160px]">
          <p className="font-barlow font-700 text-platinum text-sm mb-2 uppercase tracking-wide">
            {race?.raceName ?? label}
          </p>
          {payload.map((p: any) => (
            <p key={p.name} className="font-inter text-xs" style={{ color: p.color }}>
              {p.name === "winAcc" ? "Winner Accuracy" : "Podium Accuracy"}:{" "}
              <span className="font-600">{p.value}%</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="round"
          tick={{ fill: "#888888", fontSize: 11, fontFamily: "Barlow Condensed" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#888888", fontSize: 11, fontFamily: "Barlow Condensed" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="winAcc"
          name="winAcc"
          stroke="#E10600"
          strokeWidth={2}
          dot={{ fill: "#E10600", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#E10600" }}
        />
        <Line
          type="monotone"
          dataKey="podiumAcc"
          name="podiumAcc"
          stroke="#3671C6"
          strokeWidth={2}
          dot={{ fill: "#3671C6", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#3671C6" }}
          strokeDasharray="4 2"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
