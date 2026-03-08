import { Suspense } from "react";
import { getPredictionsStatic, getHistoryStatic, getCalendarStatic } from "@/lib/data";
import HeroBanner from "@/components/race/HeroBanner";
import PredictionGrid from "@/components/race/PredictionGrid";
import DataFreshnessBadge from "@/components/race/DataFreshnessBadge";
import AccuracyChart from "@/components/charts/AccuracyChart";
import { HeroBannerSkeleton, PredictionGridSkeleton } from "@/components/ui/Skeleton";
import { BarChart3, Database, Cpu, Link } from "lucide-react";
import NextLink from "next/link";

export const revalidate = 300; // revalidate every 5 minutes

export default async function Home() {
  const [data, history, calendar] = await Promise.all([
    getPredictionsStatic(),
    getHistoryStatic(),
    getCalendarStatic(),
  ]);

  const nextRace = data && calendar
    ? calendar.races.find((r) => r.round > data.round)
    : null;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-sm bg-surface flex items-center justify-center">
          <BarChart3 size={24} className="text-muted" />
        </div>
        <h1 className="font-barlow font-800 text-2xl uppercase tracking-wide text-platinum">
          Predictions Loading
        </h1>
        <p className="font-inter text-sm text-muted text-center max-w-sm">
          The prediction pipeline runs before each race weekend. Check back closer to qualifying.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <Suspense fallback={<HeroBannerSkeleton />}>
        <HeroBanner
          data={data}
          nextRaceDate={nextRace?.race_datetime}
          nextRaceName={nextRace?.name}
        />
      </Suspense>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Data freshness + accuracy */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
          <div className="lg:col-span-2">
            <DataFreshnessBadge
              freshness={data.data_freshness}
              predictedAt={data.predicted_at}
            />
          </div>
          <div className="glass-card p-3 flex items-center justify-between">
            <div>
              <p className="font-barlow font-700 text-xs text-muted uppercase tracking-widest mb-1">
                2026 Winner Accuracy
              </p>
              <p className="font-barlow font-900 text-2xl text-platinum tabular-nums">
                {history?.season_winner_accuracy != null
                  ? `${Math.round(history.season_winner_accuracy * 100)}%`
                  : "—"}
              </p>
            </div>
            <BarChart3 size={28} className="text-muted" />
          </div>
        </div>

        {/* Full prediction grid */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-barlow font-800 text-2xl uppercase tracking-wide text-platinum">
              Full Grid Predictions
            </h2>
            <span className="font-inter text-xs text-muted">
              {data.predictions.length} drivers · {data.circuit}
            </span>
          </div>
          <Suspense fallback={<PredictionGridSkeleton />}>
            <PredictionGrid predictions={data.predictions} />
          </Suspense>
        </section>

        {/* Season accuracy */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-barlow font-800 text-2xl uppercase tracking-wide text-platinum">
              Season Accuracy
            </h2>
            {history?.results.length ? (
              <span className="font-inter text-xs text-muted">
                {history.results.length} races completed
              </span>
            ) : null}
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-f1-red" />
                <span className="font-inter text-xs text-muted">Winner Accuracy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-team-redbull border-dashed" style={{ borderStyle: "dashed", borderWidth: 1, height: 0 }} />
                <span className="font-inter text-xs text-muted">Podium Accuracy</span>
              </div>
            </div>
            {history && <AccuracyChart history={history} />}
          </div>
        </section>

        {/* How it works teaser */}
        <section>
          <div className="glass-card p-6 border-f1-red/20 hover:border-f1-red/40 transition-colors duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[
                {
                  icon: Database,
                  title: "Real Data",
                  desc: "OpenF1 live telemetry, qualifying times, practice pace, pit stop data.",
                },
                {
                  icon: Cpu,
                  title: "ML Ensemble",
                  desc: "XGBoost + LightGBM trained on 2022–2026 races with 2026 regulation weighting.",
                },
                {
                  icon: BarChart3,
                  title: "Validated",
                  desc: "TimeSeriesSplit cross-validation. Never trained on future data.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-sm bg-surface-2 flex items-center justify-center">
                    <Icon size={16} className="text-muted" />
                  </div>
                  <div>
                    <p className="font-barlow font-700 text-sm text-platinum uppercase tracking-wide mb-1">{title}</p>
                    <p className="font-inter text-xs text-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <NextLink
              href="/model"
              className="inline-flex items-center gap-2 font-barlow font-700 text-sm uppercase tracking-widest text-f1-red hover:text-platinum transition-colors"
            >
              Full Model Details
              <span className="text-base">→</span>
            </NextLink>
          </div>
        </section>
      </div>
    </div>
  );
}
