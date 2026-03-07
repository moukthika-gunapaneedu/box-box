import type { RacePrediction, HistoryData, CalendarData } from "./types";

export async function getPredictions(): Promise<RacePrediction | null> {
  try {
    const res = await fetch("/data/predictions.json", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getHistory(): Promise<HistoryData | null> {
  try {
    const res = await fetch("/data/history.json", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// For static builds: fetch from filesystem (SSG)
export async function getPredictionsStatic(): Promise<RacePrediction | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "predictions.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getHistoryStatic(): Promise<HistoryData | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "history.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getCalendarStatic(): Promise<CalendarData | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "calendar.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
