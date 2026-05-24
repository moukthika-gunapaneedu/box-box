"use client";

import { motion } from "framer-motion";
import type { RacePrediction } from "@/lib/types";
import CountdownTimer from "@/components/ui/CountdownTimer";
import Pill from "@/components/ui/Pill";
import PredictionCard from "./PredictionCard";
import { useCountdown } from "@/hooks/useCountdown";

interface HeroBannerProps {
  data: RacePrediction;
  nextRaceDate?: string;
  nextRaceName?: string;
}

const FRESHNESS_LABELS: Record<string, string> = {
  "post-sprint": "Post Sprint",
  "post-qualifying": "Post Qualifying",
  "post-fp": "Post Practice",
  "pre-weekend": "Pre-Weekend",
  "race-day": "Race Day",
};

// Circuit outlines: path + viewBox keyed by circuit name from predictions.json
const CIRCUIT_PATHS: Record<string, { d: string; viewBox: string }> = {
  "Circuit Gilles Villeneuve": {
    viewBox: "0 0 1494.5 729.5",
    d: "M 384,409.9 C 349,410.7 313.9,410.9 278.8,411 C 259.7,411 240.5,412 221.3,410.7 C 206.5,409.7 191.8,407.8 177.5,404 C 154.7,398 132.5,389.2 110,381.5 C 100.9,378.5 92,373.9 82.9,371.9 C 79,371 74.2,371 70.8,373 C 65.5,376.3 60.5,381.9 56.8,387.5 C 52.9,393.5 52,402.5 47.8,407.5 C 44.8,411.3 39,414 34.7,414 C 30.5,413.9 25.3,410.7 21.8,407.5 C 18.3,404.2 15.3,399.3 13.7,394.5 C 12.2,390 11.5,384.5 12.2,379.7 C 13.3,372 15.8,364.3 18.9,357.2 C 27.5,337.9 41.2,332.5 51.5,314.3 C 54.8,308 59.3,302.7 63.9,297.5 C 74.3,285.9 84.7,274.2 96.2,264 C 121.2,242 147,220.5 173.5,201.5 C 175.9,199.5 179.9,199.5 182.7,200.5 C 191.2,204 198.7,212.9 207.3,215.5 C 212.8,217.2 219.8,216.3 225.3,213.7 C 249.5,202 273.8,188.5 296,173 C 309.2,163.7 318.8,148.9 331.5,138.9 C 338.9,133 347.5,128.5 356.5,125.5 C 366.9,121.9 378.5,118.5 389.5,119.5 C 416.5,121.8 443.5,129.8 470.5,135.5 C 482.9,138.2 507.5,143.3 519.8,144.7 C 524.3,145.2 529.3,143.7 533.2,141.5 C 537,139 540.9,135 542.8,130.9 C 544.7,126.5 544.5,120.7 544.5,115.5 C 544.5,110.5 545.7,104.9 547,100.2 C 549.2,92.3 553.8,83.7 559.3,77.8 C 564.5,72.3 572,68.2 579.3,66 C 590.8,62.5 590.8,61.3 602.8,60.8 C 612.7,60.5 618.5,61.8 628.5,63 C 665,67.9 701.8,72.5 738,78.9 C 755.2,82 771.9,87.5 788.7,92 C 802.5,95.5 816.5,98.3 830,103.2 C 852,111 873.9,119.8 895,130.2 C 918.7,141.7 941.2,156 964.3,168.8 C 972.5,173.5 981.5,177.2 989.2,182.5 C 992.5,184.7 996.8,187.5 998,191.2 C 999.5,195 997.2,200.2 997,204.7 C 996.7,210.5 995.7,216.5 996.5,222 C 997.5,227 999.5,232.5 1002.5,236.3 C 1007.3,242.5 1013.8,247.9 1020.3,252.3 C 1036.5,263.5 1053.2,274 1070.5,283 C 1103.3,300 1136.9,315.8 1170.8,330.3 C 1193,339.7 1215.9,347.8 1238.9,354.9 C 1250,358.2 1261.5,359.7 1273,361.5 C 1288,363.7 1303.3,366 1318.5,366.8 C 1336.7,367.7 1354.9,366.8 1373,366.3 C 1384.5,366 1396,364.5 1407.5,364.5 C 1410.7,364.5 1415,364 1416.8,366.2 C 1418.9,368.8 1418.9,374.5 1419,378.5 C 1419.2,381 1419,384.3 1417.7,386 C 1415.3,389.2 1411.5,392.3 1407.9,393.2 C 1399.3,395.3 1389.8,395.8 1380.9,395.2 C 1375,394.9 1369.5,391.2 1363.5,390.5 C 1352.9,388.9 1342,387.9 1331.5,388.5 C 1324.8,388.7 1318.3,391.2 1311.8,392.9 C 1293.2,398 1274.9,404.7 1256.2,409 C 1220.5,417.2 1182.8,420.2 1146.8,426.8 C 1123.2,431 1099.5,434.8 1075.7,438 C 1064.5,439.5 1053,440.8 1041.7,441 C 998.5,442 954.2,439.5 910.9,440 C 833.5,440.9 755.5,440.8 678,441 C 641.9,441.3 604.5,435.7 568.9,433.3 C 565.7,433 563,429.5 561.5,426.5 C 558.9,422.2 559,415.5 556.5,411.5 C 554.8,408.8 551.5,406.5 548.5,406 C 541,404.7 532.7,405.5 524.7,405.7 C 502,405.9 479.5,406.3 456.9,407 C 432.5,407.7 408.3,409.5 384,409.9 Z",
  },
  "Miami International Autodrome": {
    viewBox: "0 0 794.1 434",
    d: "M316.8,101.5c15.4,9.2,159,93,165.6,97c8.1,5,10.4,9.9,10.4,14.7c0,3.6-4.3,10.7-12.4,15.1c-8.1,4.4-17.8,9.4-18.7,18.9s4.6,34.7-8.3,45c-13,10.3-28.3,22.8-69.8,22.8c-16.9,0-43.5-11.2-57.5-19.5c-14-8.3-76.4-44.8-83-48.3s-14.7-6.6-23-6.4s-21.7,4.6-30.3,11.2c-8.6,6.6-17.8,13.2-34.2,13.2c-13.8,0-26.1-14.3-29.2-17.8c-3.1-3.5-15.4-15.1-30.5-15.1s-34.2,5.9-43,14c-8.8,8.1-14.9,14.3-14.9,31.4s14.5,20.4,23.3,20.4c5.9,0,13-2,29.6-2s41.7,13.6,69.6,13.6S285,308,292.6,308c7.7,0,22.4,1.3,36.7,7c14.3,5.7,51.8,27,99.2,27c16.7,0,48.5-1.5,65.9-6.4s101-33.8,114.4-38.9c4.2-1.6,36.5-15.3,64.1-29c22.2-11,31.9-15.2,41.5-22.4c2.9-2.2,4.8-4.1,4.8-7.9s-5.2-6.4-7.6-8.1c-2.4-1.7-12.8-7.8-15.8-9.8c-3-2-11.2-7.4-11.2-19c0-11.6,7.4-21.4,19.5-21.4s19.1,0,22.9,0s11.6,0.8,18.4-8.6s10.6-15.7,11.1-17.4s1.9-5-0.9-6.8c-2.8-1.8-5.3-3.4-6.1-3.9s-2.5-2.7-1.3-7.8c1.2-5.1,6.7-23.3,7.1-26.9c0.4-3.6,1.2-10.9-6.2-11c-7.4-0.1-472.7-18.4-493.1-19.3c-20.4-0.9-117.2-4.6-122.5-4.6s-10.2,2-10.2,8.4c0,6.4,3.4,8.3,6.3,10.7c2.9,2.4,26,17.6,28.8,19.5s8.4,4.8,16,4.8c4.2,0,6.8,0,9.2,0c7.1,0,14.1-2.8,19.2-5.3c5.1-2.5,31.6-15.8,36.9-18c5.3-2.2,12.6-2.9,20.3-2.9c7.7,0,18.4,0,23.2,0s17,2.8,22.1,5.3S316.8,101.5,316.8,101.5z",
  },
  _fallback: {
    viewBox: "0 0 400 300",
    d: "M50 250 C50 250 80 200 120 180 L180 160 C220 140 240 100 280 80 C320 60 360 80 380 120 L380 180 C380 220 340 240 300 240 L200 240 C160 240 140 260 120 280 L80 280 C60 280 50 265 50 250Z",
  },
};

export default function HeroBanner({ data, nextRaceDate, nextRaceName }: HeroBannerProps) {
  const top3 = data.predictions.slice(0, 3);
  const pole = top3.find((p) => p.quali_position === 1) ?? top3[0];
  const { isPast, isLive } = useCountdown(data.race_date);
  const showingNextRace = isPast && !isLive && !!nextRaceDate;

  return (
    <section className="relative overflow-hidden bg-carbon border-b border-border">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${top3[0]?.team_color ?? "#E10600"}, transparent)`,
        }}
      />

      {/* Circuit silhouette decoration */}
      {(() => {
        const circuit = CIRCUIT_PATHS[data.circuit] ?? CIRCUIT_PATHS._fallback;
        return (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.06] hidden lg:block">
            <svg viewBox={circuit.viewBox} className="w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">
              <path
                d={circuit.d}
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        );
      })()}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Round badge + freshness */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center gap-2 mb-4"
        >
          <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest border border-border px-2 py-1 rounded-sm">
            RD {String(data.round).padStart(2, "0")} · {data.season}
          </span>
          <Pill
            label={FRESHNESS_LABELS[data.data_freshness] ?? data.data_freshness}
            variant={data.data_freshness as any}
          />
          {data.model_source === "heuristic" && (
            <Pill label="Heuristic Model" variant="neutral" />
          )}
        </motion.div>

        {/* Race name */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-barlow font-900 text-4xl sm:text-5xl lg:text-7xl uppercase tracking-tight text-platinum leading-none mb-2"
        >
          {data.race.replace(" Grand Prix", "")}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="font-barlow font-600 text-lg text-muted uppercase tracking-widest mb-6"
        >
          {data.circuit}
        </motion.p>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10"
        >
          <p className="font-barlow font-600 text-xs text-muted uppercase tracking-widest mb-2">
            {showingNextRace ? `Next Race · ${nextRaceName?.replace(" Grand Prix", "")}` : "Race Start"}
          </p>
          <CountdownTimer
            raceDate={data.race_date}
            nextRaceDate={nextRaceDate}
            nextRaceName={nextRaceName}
          />
        </motion.div>

        {/* Top 3 prediction cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
          {top3.map((prediction, i) => (
            <motion.div
              key={prediction.driver_code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              className="h-full"
            >
              <PredictionCard prediction={prediction} rank={i + 1} delay={0.3 + i * 0.1} />
            </motion.div>
          ))}
        </div>

        {/* Pole position indicator */}
        {data.data_freshness === "post-qualifying" && pole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 flex items-center gap-2"
          >
            <span className="font-barlow font-600 text-xs text-muted uppercase tracking-widest">
              Pole Position:
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: pole.team_color }}
              />
              <span className="font-barlow font-700 text-sm text-platinum">
                {pole.driver_name}
              </span>
              <span className="font-inter text-xs text-muted">{pole.team}</span>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
