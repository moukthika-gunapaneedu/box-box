import { getHistoryStatic, getCalendarStatic } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import type { PodiumEntry } from "@/lib/types";

export async function generateStaticParams() {
  const calendar = await getCalendarStatic();
  const season = calendar?.season ?? 2026;
  const rounds = calendar?.races.map((r) => r.round) ?? [];
  return rounds.map((round) => ({
    season: String(season),
    round: String(round),
  }));
}

const POSITIONS = ["P1", "P2", "P3"];

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ season: string; round: string }>;
}) {
  const { round: roundParam } = await params;
  const roundNum = parseInt(roundParam, 10);
  const [history, calendarData] = await Promise.all([
    getHistoryStatic(),
    getCalendarStatic(),
  ]);

  const race = calendarData?.races.find((r) => r.round === roundNum);
  if (!race) notFound();

  const result = history?.results.find((r) => r.round === roundNum);
  const isCompleted = !!result;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link
        href="/races"
        className="inline-flex items-center gap-2 font-inter text-xs text-muted hover:text-platinum transition-colors mb-8"
      >
        <ArrowLeft size={12} />
        Race Calendar
      </Link>

      {/* Header */}
      <div className="mb-10">
        <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest">
          Round {race.round} · {calendarData?.season}
        </span>
        <h1 className="font-barlow font-900 text-4xl uppercase tracking-tight text-platinum mt-2">
          {race.name}
        </h1>
        <p className="font-inter text-sm text-muted mt-1">
          {race.circuit}{race.locality ? ` · ${race.locality}` : ""}
        </p>
        <p className="font-inter text-xs text-muted mt-1">
          {new Date(race.race_datetime || race.date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {isCompleted && result ? (
        <>
          {/* Accuracy banner */}
          <div
            className={`flex items-center gap-3 p-4 rounded-lg mb-8 border ${
              result.correct_win
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-red-500/10 border-red-500/30"
            }`}
          >
            {result.correct_win ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : (
              <XCircle size={18} className="text-red-400 shrink-0" />
            )}
            <div>
              <p className={`font-barlow font-800 text-sm uppercase tracking-wide ${result.correct_win ? "text-emerald-400" : "text-red-400"}`}>
                {result.correct_win ? "Winner correctly predicted" : "Winner not predicted"}
              </p>
              <p className="font-inter text-xs text-muted mt-0.5">
                {result.podium_hits} of 3 podium drivers predicted correctly
              </p>
            </div>
          </div>

          {/* Top 3 comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Predicted */}
            <div>
              <p className="font-barlow font-700 text-xs text-muted uppercase tracking-widest mb-3">
                Our Prediction
              </p>
              <div className="space-y-2">
                {(result.predicted_top3 ?? result.predicted_podium.map((code) => ({ driver_code: code, driver_name: code, team: "", team_color: "#888" }))).map(
                  (entry: PodiumEntry, i: number) => {
                    const hit = result.actual_podium.includes(entry.driver_code);
                    return (
                      <div
                        key={entry.driver_code}
                        className="glass-card p-3 flex items-center gap-3"
                        style={{ borderLeftColor: entry.team_color, borderLeftWidth: 3 }}
                      >
                        <span className="font-barlow font-900 text-muted text-sm w-6 shrink-0">
                          {POSITIONS[i]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-barlow font-800 text-sm text-platinum uppercase truncate">
                            {entry.driver_name}
                          </p>
                          {entry.win_probability !== undefined && (
                            <p className="font-inter text-[10px] text-muted">
                              {(entry.win_probability * 100).toFixed(1)}% win
                            </p>
                          )}
                        </div>
                        {hit ? (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-red-400/60 shrink-0" />
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Actual */}
            <div>
              <p className="font-barlow font-700 text-xs text-muted uppercase tracking-widest mb-3">
                What Happened
              </p>
              <div className="space-y-2">
                {(result.actual_top3 ?? result.actual_podium.map((code) => ({ driver_code: code, driver_name: code, team: "", team_color: "#888" }))).map(
                  (entry: PodiumEntry, i: number) => {
                    const predicted = result.predicted_podium.includes(entry.driver_code);
                    return (
                      <div
                        key={entry.driver_code}
                        className="glass-card p-3 flex items-center gap-3"
                        style={{ borderLeftColor: entry.team_color, borderLeftWidth: 3 }}
                      >
                        <span className="font-barlow font-900 text-muted text-sm w-6 shrink-0">
                          {POSITIONS[i]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-barlow font-800 text-sm text-platinum uppercase truncate">
                            {entry.driver_name}
                          </p>
                          <p className="font-inter text-[10px] text-muted">{entry.team}</p>
                        </div>
                        {predicted ? (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-red-400/60 shrink-0" />
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Upcoming race — no result yet */
        <div className="glass-card p-6 text-center">
          <p className="font-barlow font-700 text-sm text-muted uppercase tracking-wide">
            No result yet
          </p>
          <p className="font-inter text-xs text-muted mt-1">
            Check back after the race for prediction vs actual analysis.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 font-barlow font-700 text-xs text-f1-red uppercase tracking-widest hover:text-platinum transition-colors"
          >
            View Current Prediction →
          </Link>
        </div>
      )}
    </div>
  );
}
