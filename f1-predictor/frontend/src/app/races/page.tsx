import { getHistoryStatic, getCalendarStatic } from "@/lib/data";
import { CheckCircle2, Circle, Radio } from "lucide-react";
import Link from "next/link";

export default async function RacesPage() {
  const [history, calendarData] = await Promise.all([
    getHistoryStatic(),
    getCalendarStatic(),
  ]);

  const races = calendarData?.races ?? [];
  const completedRounds = new Set(history?.results.map((r) => r.round) ?? []);
  const today = new Date();

  if (!races.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="font-inter text-muted text-sm">
          Calendar not yet loaded. Run the prediction pipeline to fetch live race data.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest">
          {calendarData?.season} Season
        </span>
        <h1 className="font-barlow font-900 text-4xl uppercase tracking-tight text-platinum mt-2">
          Race Calendar
        </h1>
        <p className="font-inter text-sm text-muted mt-2">
          {completedRounds.size} of {races.length} races completed
        </p>
      </div>

      <div className="space-y-1">
        {races.map((race) => {
          const raceDate = race.race_datetime ? new Date(race.race_datetime) : new Date(race.date);
          const isCompleted = completedRounds.has(race.round);
          const isToday = race.date === today.toISOString().split("T")[0];
          const isPast = raceDate < today && !isToday;
          const result = history?.results.find((r) => r.round === race.round);

          return (
            <Link
              key={race.round}
              href={`/races/${calendarData?.season}/${race.round}`}
              className="flex items-center gap-4 p-4 glass-card hover:bg-surface-2 transition-colors group"
            >
              <span className="font-barlow font-900 text-muted text-lg w-8 shrink-0 tabular-nums">
                {String(race.round).padStart(2, "0")}
              </span>

              <div
                className="w-0.5 h-10 rounded-full shrink-0"
                style={{ background: isCompleted ? "#E10600" : isPast ? "#333" : "#2A2A2A" }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-barlow font-700 text-base text-platinum uppercase tracking-tight group-hover:text-f1-red transition-colors">
                    {race.name}
                  </p>
                  {isToday && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-f1-red/10 border border-f1-red/30">
                      <Radio size={8} className="text-f1-red animate-pulse" />
                      <span className="font-barlow font-700 text-[10px] text-f1-red uppercase tracking-widest">Live</span>
                    </div>
                  )}
                </div>
                <p className="font-inter text-xs text-muted">
                  {race.circuit}{race.locality ? ` · ${race.locality}` : ""}
                </p>
              </div>

              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <p className="font-barlow font-600 text-xs text-muted">
                  {raceDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                {result ? (
                  <div className="flex items-center gap-1">
                    {result.correct_win ? (
                      <CheckCircle2 size={10} className="text-emerald-400" />
                    ) : (
                      <Circle size={10} className="text-muted" />
                    )}
                    <span className="font-inter text-[10px] text-muted">{result.actual_winner}</span>
                  </div>
                ) : (
                  <span className="font-inter text-[10px] text-muted">
                    {isPast ? "No data" : "Upcoming"}
                  </span>
                )}
              </div>

              <span className="text-muted group-hover:text-platinum transition-colors text-lg">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
