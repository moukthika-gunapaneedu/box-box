"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  raceDate: string;
  className?: string;
}

export default function CountdownTimer({ raceDate, className }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isLive, isPast, totalSeconds } = useCountdown(raceDate);

  if (isLive) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <span className="live-dot scale-125" />
        <span className="font-barlow font-800 text-f1-red text-2xl sm:text-3xl tracking-widest uppercase animate-pulse-red">
          Race Live
        </span>
      </div>
    );
  }

  if (isPast) {
    return (
      <span className={cn("font-barlow font-700 text-muted text-xl tracking-widest uppercase", className)}>
        Race Complete
      </span>
    );
  }

  const isUrgent = totalSeconds < 3600;

  return (
    <div className={cn("flex items-center gap-2 sm:gap-4", className)}>
      {[
        { value: days, label: "D" },
        { value: hours, label: "H" },
        { value: minutes, label: "M" },
        { value: seconds, label: "S" },
      ].map(({ value, label }, i) => (
        <div key={label} className="flex items-baseline gap-0.5">
          {i > 0 && (
            <span className={cn("font-barlow font-700 text-muted text-2xl sm:text-3xl mx-0.5", isUrgent && "text-f1-red/60")}>
              :
            </span>
          )}
          <span
            className={cn(
              "font-barlow font-800 tabular-nums text-3xl sm:text-4xl lg:text-5xl tracking-tight",
              isUrgent ? "text-f1-red animate-pulse-red" : "text-platinum"
            )}
          >
            {String(value).padStart(2, "0")}
          </span>
          <span className="font-barlow font-600 text-muted text-sm uppercase ml-0.5 self-end mb-1">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
