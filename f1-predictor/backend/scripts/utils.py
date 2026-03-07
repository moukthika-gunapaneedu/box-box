"""Shared utilities: team colors, 2026 driver roster, circuit list, helpers."""

from __future__ import annotations
import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# 2026 team colors (hex)
# ---------------------------------------------------------------------------
TEAM_COLORS: dict[str, str] = {
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Mercedes": "#27F4D2",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "RB": "#6692FF",
    "Haas": "#B6BABD",
    "Kick Sauber": "#52E252",
    "Cadillac": "#B40000",
}

# ---------------------------------------------------------------------------
# 2026 driver roster  {driver_code: {name, team, number}}
# ---------------------------------------------------------------------------
DRIVERS_2026: dict[str, dict] = {
    "VER": {"name": "Max Verstappen",     "team": "Red Bull Racing", "number": 1},
    "LAW": {"name": "Liam Lawson",        "team": "Red Bull Racing", "number": 30},
    "LEC": {"name": "Charles Leclerc",    "team": "Ferrari",         "number": 16},
    "HAM": {"name": "Lewis Hamilton",     "team": "Ferrari",         "number": 44},
    "NOR": {"name": "Lando Norris",       "team": "McLaren",         "number": 4},
    "PIA": {"name": "Oscar Piastri",      "team": "McLaren",         "number": 81},
    "RUS": {"name": "George Russell",     "team": "Mercedes",        "number": 63},
    "ANT": {"name": "Kimi Antonelli",     "team": "Mercedes",        "number": 12},
    "ALO": {"name": "Fernando Alonso",    "team": "Aston Martin",    "number": 14},
    "STR": {"name": "Lance Stroll",       "team": "Aston Martin",    "number": 18},
    "GAS": {"name": "Pierre Gasly",       "team": "Alpine",          "number": 10},
    "DOO": {"name": "Jack Doohan",        "team": "Alpine",          "number": 7},
    "ALB": {"name": "Alexander Albon",    "team": "Williams",        "number": 23},
    "SAI": {"name": "Carlos Sainz",       "team": "Williams",        "number": 55},
    "TSU": {"name": "Yuki Tsunoda",       "team": "RB",              "number": 22},
    "HAD": {"name": "Isack Hadjar",       "team": "RB",              "number": 6},
    "HUL": {"name": "Nico Hulkenberg",    "team": "Haas",            "number": 27},
    "BEA": {"name": "Oliver Bearman",     "team": "Haas",            "number": 87},
    "BOT": {"name": "Valtteri Bottas",    "team": "Kick Sauber",     "number": 77},
    "BOR": {"name": "Gabriel Bortoleto",  "team": "Kick Sauber",     "number": 5},
    "HUL2": {"name": "Colton Herta",      "team": "Cadillac",        "number": 99},
    "FIT": {"name": "Felipe Drugovich",   "team": "Cadillac",        "number": 25},
}

# Map driver_code → team color
def driver_team_color(driver_code: str) -> str:
    d = DRIVERS_2026.get(driver_code, {})
    team = d.get("team", "")
    return TEAM_COLORS.get(team, "#888888")


# Circuit type lookup by circuit name keyword (used to enrich API calendar data)
# Dates and round numbers always come from the live API — never hardcoded here.
CIRCUIT_TYPE_MAP: dict[str, str] = {
    "albert park": "street_hybrid",
    "shanghai": "technical",
    "suzuka": "high_speed",
    "bahrain": "technical",
    "jeddah": "street",
    "miami": "street_hybrid",
    "imola": "technical",
    "monaco": "street",
    "barcelona": "technical",
    "villeneuve": "street_hybrid",
    "red bull ring": "high_speed",
    "silverstone": "high_speed",
    "spa": "high_speed",
    "hungaroring": "technical",
    "zandvoort": "high_speed",
    "monza": "high_speed",
    "baku": "street",
    "marina bay": "street",
    "americas": "technical",
    "hermanos rodriguez": "technical",
    "interlagos": "technical",
    "las vegas": "street",
    "lusail": "high_speed",
    "yas marina": "technical",
}

def get_circuit_type(circuit_name: str) -> str:
    """Look up circuit type from circuit name."""
    name_lower = circuit_name.lower()
    for keyword, ctype in CIRCUIT_TYPE_MAP.items():
        if keyword in name_lower:
            return ctype
    return "technical"

# Overtake difficulty index per circuit type (lower = harder to overtake)
OVERTAKE_INDEX: dict[str, float] = {
    "street": 0.3,
    "street_hybrid": 0.5,
    "technical": 0.6,
    "high_speed": 0.8,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def calculate_dnf_rate(results_df: pd.DataFrame, driver_col: str = "driverCode",
                       status_col: str = "status", n: int | None = None) -> pd.Series:
    """Return DNF rate per driver (proportion of races not finished)."""
    if n is not None:
        results_df = results_df.groupby(driver_col).tail(n)
    dnf = results_df.copy()
    dnf["dnf"] = ~dnf[status_col].str.lower().str.contains("finished|+", regex=False)
    return dnf.groupby(driver_col)["dnf"].mean().rename("dnf_rate")


def rolling_avg_finish(results_df: pd.DataFrame, driver_col: str = "driverCode",
                       pos_col: str = "position", n: int = 5) -> pd.Series:
    """Return rolling average finish position over last n races per driver."""
    out = (
        results_df.sort_values(["season", "round"])
        .groupby(driver_col)[pos_col]
        .apply(lambda s: s.rolling(n, min_periods=1).mean().iloc[-1])
    )
    return out.rename(f"avg_finish_{n}")


def season_weight(season: int, current_season: int = 2026) -> float:
    """Down-weight older seasons. 2026 regs are new so pre-2026 data matters less."""
    delta = current_season - season
    weights = {0: 5.0, 1: 1.0, 2: 0.5, 3: 0.25}
    return weights.get(delta, 0.1)
