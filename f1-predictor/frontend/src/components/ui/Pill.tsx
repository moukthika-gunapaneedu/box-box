import { cn } from "@/lib/utils";

interface PillProps {
  label: string;
  variant: "high" | "medium" | "low" | "live" | "post-qualifying" | "post-fp" | "pre-weekend" | "neutral";
  className?: string;
}

const VARIANTS = {
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-red-500/10 text-red-400 border-red-500/20",
  live: "bg-f1-red/10 text-f1-red border-f1-red/30",
  "post-qualifying": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "post-fp": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "pre-weekend": "bg-surface-2 text-muted border-border",
  neutral: "bg-surface-2 text-muted border-border",
};

export default function Pill({ label, variant, className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm border font-barlow font-700 text-xs uppercase tracking-widest",
        VARIANTS[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
