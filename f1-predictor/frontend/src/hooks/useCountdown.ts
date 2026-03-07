"use client";

import { useState, useEffect } from "react";

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
  isPast: boolean;
  totalSeconds: number;
}

export function useCountdown(targetDate: string): CountdownResult {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();
  const totalSeconds = Math.floor(diff / 1000);

  if (totalSeconds < 0) {
    // Check if race is "live" (within 3 hours after start)
    const isLive = Math.abs(totalSeconds) < 3 * 3600;
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive, isPast: true, totalSeconds };
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isLive: false, isPast: false, totalSeconds };
}
