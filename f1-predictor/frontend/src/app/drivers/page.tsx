import { getHistoryStatic, getPredictionsStatic } from "@/lib/data";
import { TEAM_COLORS } from "@/lib/teamColors";

const DRIVERS_2026 = [
  { code: "VER", name: "Max Verstappen",    team: "Red Bull Racing", number: 1  },
  { code: "LAW", name: "Liam Lawson",       team: "Red Bull Racing", number: 30 },
  { code: "LEC", name: "Charles Leclerc",   team: "Ferrari",         number: 16 },
  { code: "HAM", name: "Lewis Hamilton",    team: "Ferrari",         number: 44 },
  { code: "NOR", name: "Lando Norris",      team: "McLaren",         number: 4  },
  { code: "PIA", name: "Oscar Piastri",     team: "McLaren",         number: 81 },
  { code: "RUS", name: "George Russell",    team: "Mercedes",        number: 63 },
  { code: "ANT", name: "Kimi Antonelli",    team: "Mercedes",        number: 12 },
  { code: "ALO", name: "Fernando Alonso",   team: "Aston Martin",    number: 14 },
  { code: "STR", name: "Lance Stroll",      team: "Aston Martin",    number: 18 },
  { code: "GAS", name: "Pierre Gasly",      team: "Alpine",          number: 10 },
  { code: "DOO", name: "Jack Doohan",       team: "Alpine",          number: 7  },
  { code: "ALB", name: "Alexander Albon",   team: "Williams",        number: 23 },
  { code: "SAI", name: "Carlos Sainz",      team: "Williams",        number: 55 },
  { code: "TSU", name: "Yuki Tsunoda",      team: "RB",              number: 22 },
  { code: "HAD", name: "Isack Hadjar",      team: "RB",              number: 6  },
  { code: "HUL", name: "Nico Hulkenberg",   team: "Haas",            number: 27 },
  { code: "BEA", name: "Oliver Bearman",    team: "Haas",            number: 87 },
  { code: "BOT", name: "Valtteri Bottas",   team: "Kick Sauber",     number: 77 },
  { code: "BOR", name: "Gabriel Bortoleto", team: "Kick Sauber",     number: 5  },
];

const TEAMS = [...new Set(DRIVERS_2026.map((d) => d.team))];

export default async function DriversPage() {
  const [predictions, history] = await Promise.all([
    getPredictionsStatic(),
    getHistoryStatic(),
  ]);

  // Build win stats from history
  const winStats: Record<string, number> = {};
  history?.results.forEach((r) => {
    winStats[r.actual_winner] = (winStats[r.actual_winner] ?? 0) + 1;
  });

  // Current prediction win probabilities
  const winProbs: Record<string, number> = {};
  predictions?.predictions.forEach((p) => {
    winProbs[p.driver_code] = p.win_probability;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <span className="font-barlow font-700 text-xs text-muted uppercase tracking-widest">2026 Season</span>
        <h1 className="font-barlow font-900 text-4xl uppercase tracking-tight text-platinum mt-2">
          Drivers
        </h1>
      </div>

      {TEAMS.map((team) => {
        const teamDrivers = DRIVERS_2026.filter((d) => d.team === team);
        const color = TEAM_COLORS[team] ?? "#888888";
        return (
          <div key={team} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-6 rounded-full" style={{ background: color }} />
              <h2 className="font-barlow font-800 text-lg uppercase tracking-wide text-platinum">{team}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teamDrivers.map((driver) => (
                <div
                  key={driver.code}
                  className="glass-card p-4 flex items-center gap-4 hover:bg-surface-2 transition-colors"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <span
                    className="font-barlow font-900 text-3xl tabular-nums w-10 text-center leading-none"
                    style={{ color }}
                  >
                    {driver.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-barlow font-800 text-base text-platinum uppercase tracking-tight">
                      {driver.name}
                    </p>
                    <p className="font-inter text-xs text-muted">{driver.code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {winStats[driver.code] ? (
                      <div>
                        <p className="font-barlow font-900 text-xl text-platinum">{winStats[driver.code]}</p>
                        <p className="font-inter text-[10px] text-muted">2026 wins</p>
                      </div>
                    ) : winProbs[driver.code] ? (
                      <div>
                        <p className="font-barlow font-700 text-sm" style={{ color }}>
                          {(winProbs[driver.code] * 100).toFixed(1)}%
                        </p>
                        <p className="font-inter text-[10px] text-muted">win prob</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
