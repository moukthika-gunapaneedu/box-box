"""
Data collection from OpenF1 API and Jolpica (Ergast replacement).
All responses are cached locally to avoid repeated fetches.
"""

from __future__ import annotations
import json
import time
import hashlib
from pathlib import Path
from typing import Any

import requests
import pandas as pd

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

OPENF1_BASE = "https://api.openf1.org/v1"
JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1"

# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_path(key: str) -> Path:
    h = hashlib.md5(key.encode()).hexdigest()
    return CACHE_DIR / f"{h}.json"


def _cached_get(url: str, params: dict | None = None, ttl_hours: float = 24) -> Any:
    """GET with local JSON cache. Returns parsed JSON."""
    cache_key = url + json.dumps(params or {}, sort_keys=True)
    cp = _cache_path(cache_key)
    if cp.exists():
        age_hours = (time.time() - cp.stat().st_mtime) / 3600
        if age_hours < ttl_hours:
            return json.loads(cp.read_text())
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            cp.write_text(json.dumps(data))
            return data
        except Exception as exc:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


# ---------------------------------------------------------------------------
# Jolpica / Ergast helpers (historical)
# ---------------------------------------------------------------------------

def get_race_results(year: int, round_num: int) -> pd.DataFrame:
    """Fetch race results for a given year/round from Jolpica."""
    url = f"{JOLPICA_BASE}/{year}/{round_num}/results.json"
    data = _cached_get(url, ttl_hours=999)
    try:
        races = data["MRData"]["RaceTable"]["Races"]
        if not races:
            return pd.DataFrame()
        results = races[0]["Results"]
        rows = []
        for r in results:
            rows.append({
                "season": year,
                "round": round_num,
                "driverCode": r["Driver"].get("code", r["Driver"]["driverId"].upper()[:3]),
                "driverId": r["Driver"]["driverId"],
                "constructorId": r["Constructor"]["constructorId"],
                "grid": int(r.get("grid", 0)),
                "position": int(r["position"]),
                "points": float(r.get("points", 0)),
                "status": r.get("status", ""),
                "laps": int(r.get("laps", 0)),
            })
        return pd.DataFrame(rows)
    except (KeyError, IndexError):
        return pd.DataFrame()


def get_qualifying_results(year: int, round_num: int) -> pd.DataFrame:
    """Fetch qualifying results for a given year/round."""
    url = f"{JOLPICA_BASE}/{year}/{round_num}/qualifying.json"
    data = _cached_get(url, ttl_hours=48)
    try:
        races = data["MRData"]["RaceTable"]["Races"]
        if not races:
            return pd.DataFrame()
        results = races[0]["QualifyingResults"]
        rows = []
        for r in results:
            # Best qualifying time across Q1/Q2/Q3
            for qkey in ("Q3", "Q2", "Q1"):
                if r.get(qkey) and r[qkey] != "":
                    best_time = r[qkey]
                    break
            else:
                best_time = None
            rows.append({
                "season": year,
                "round": round_num,
                "driverCode": r["Driver"].get("code", r["Driver"]["driverId"].upper()[:3]),
                "driverId": r["Driver"]["driverId"],
                "constructorId": r["Constructor"]["constructorId"],
                "quali_position": int(r["position"]),
                "best_time": best_time,
            })
        return pd.DataFrame(rows)
    except (KeyError, IndexError):
        return pd.DataFrame()


def get_sprint_results(year: int, round_num: int) -> pd.DataFrame:
    """Fetch sprint race results for a given year/round from Jolpica."""
    url = f"{JOLPICA_BASE}/{year}/{round_num}/sprint.json"
    data = _cached_get(url, ttl_hours=48)
    try:
        races = data["MRData"]["RaceTable"]["Races"]
        if not races:
            return pd.DataFrame()
        results = races[0]["SprintResults"]
        rows = []
        for r in results:
            fl = r.get("FastestLap", {})
            fastest_lap_time = fl.get("Time", {}).get("time")
            rows.append({
                "season": year,
                "round": round_num,
                "driverCode": r["Driver"].get("code", r["Driver"]["driverId"].upper()[:3]),
                "driverId": r["Driver"]["driverId"],
                "constructorId": r["Constructor"]["constructorId"],
                "sprint_position": int(r["position"]),
                "fastest_lap_time": fastest_lap_time,
                "status": r.get("status", ""),
            })
        return pd.DataFrame(rows)
    except (KeyError, IndexError):
        return pd.DataFrame()


def get_race_calendar(year: int) -> list[dict]:
    """Return list of races for a season with full datetime info."""
    url = f"{JOLPICA_BASE}/{year}.json"
    data = _cached_get(url, ttl_hours=6)
    try:
        races = data["MRData"]["RaceTable"]["Races"]
        result = []
        for r in races:
            if not r.get("round"):
                continue
            try:
                date = r.get("date", "")
                time = r.get("time", "")
                # Build ISO UTC datetime string if time is available (e.g. "05:00:00Z")
                if date and time:
                    race_datetime = f"{date}T{time}" if time.endswith("Z") else f"{date}T{time}Z"
                elif date:
                    race_datetime = f"{date}T00:00:00Z"
                else:
                    race_datetime = ""
                loc = r.get("Circuit", {}).get("Location", {})
                result.append({
                    "season": year,
                    "round": int(r["round"]),
                    "name": r["raceName"],
                    "circuit": r["Circuit"]["circuitName"],
                    "country": loc.get("country", ""),
                    "locality": loc.get("locality", ""),
                    "lat": loc.get("lat"),
                    "lon": loc.get("long"),
                    "date": date,
                    "time": time,
                    "race_datetime": race_datetime,
                })
            except (KeyError, IndexError):
                continue
        return result
    except (KeyError, IndexError):
        return []


def get_driver_standings(year: int, round_num: int | None = None) -> pd.DataFrame:
    """Driver standings at a given point in the season."""
    url = f"{JOLPICA_BASE}/{year}/driverStandings.json"
    if round_num:
        url = f"{JOLPICA_BASE}/{year}/{round_num}/driverStandings.json"
    data = _cached_get(url, ttl_hours=6)
    try:
        standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not standings_list:
            return pd.DataFrame()
        rows = []
        for s in standings_list[0]["DriverStandings"]:
            rows.append({
                "driverCode": s["Driver"].get("code", s["Driver"]["driverId"].upper()[:3]),
                "driverId": s["Driver"]["driverId"],
                "position": int(s["position"]),
                "points": float(s["points"]),
                "wins": int(s["wins"]),
            })
        return pd.DataFrame(rows)
    except (KeyError, IndexError):
        return pd.DataFrame()


def get_constructor_standings(year: int, round_num: int | None = None) -> pd.DataFrame:
    """Constructor standings at a given point in the season."""
    url = f"{JOLPICA_BASE}/{year}/constructorStandings.json"
    if round_num:
        url = f"{JOLPICA_BASE}/{year}/{round_num}/constructorStandings.json"
    data = _cached_get(url, ttl_hours=6)
    try:
        standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not standings_list:
            return pd.DataFrame()
        rows = []
        for s in standings_list[0]["ConstructorStandings"]:
            rows.append({
                "constructorId": s["Constructor"]["constructorId"],
                "constructor_name": s["Constructor"]["name"],
                "position": int(s["position"]),
                "points": float(s["points"]),
                "wins": int(s["wins"]),
            })
        return pd.DataFrame(rows)
    except (KeyError, IndexError):
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# OpenF1 API (real-time / 2026 data)
# ---------------------------------------------------------------------------

def get_openf1_sessions(year: int, circuit_key: int | None = None) -> list[dict]:
    """List sessions from OpenF1."""
    params: dict = {"year": year}
    if circuit_key:
        params["circuit_key"] = circuit_key
    return _cached_get(f"{OPENF1_BASE}/sessions", params=params, ttl_hours=6) or []


def get_openf1_drivers(session_key: int) -> list[dict]:
    """Driver entries for a session."""
    return _cached_get(f"{OPENF1_BASE}/drivers", params={"session_key": session_key}, ttl_hours=999) or []


def get_openf1_laps(session_key: int, driver_number: int | None = None) -> list[dict]:
    """Lap data for a session, optionally filtered by driver."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return _cached_get(f"{OPENF1_BASE}/laps", params=params, ttl_hours=6) or []


def get_openf1_pit(session_key: int) -> list[dict]:
    """Pit stop data for a session."""
    return _cached_get(f"{OPENF1_BASE}/pit", params={"session_key": session_key}, ttl_hours=6) or []


def get_openf1_weather(session_key: int) -> list[dict]:
    """Weather data for a session."""
    return _cached_get(f"{OPENF1_BASE}/weather", params={"session_key": session_key}, ttl_hours=6) or []


def get_session_laps(year: int, round_num: int, session_type: str = "Race") -> pd.DataFrame:
    """
    High-level helper: get lap times for a session as a DataFrame.
    session_type: 'Race', 'Qualifying', 'Practice 1', 'Practice 2', 'Practice 3'
    """
    from collect_data import get_race_calendar
    sessions = get_openf1_sessions(year)
    target = [s for s in sessions if s.get("session_type") == session_type and s.get("round_number") == round_num]

    # OpenF1 sometimes omits round_number (seen in 2026). Fall back to matching
    # the right session by calendar date: find sessions of the correct type
    # within the 4-day window before (and including) the race date for this round.
    if not target:
        try:
            cal = get_race_calendar(year)
            race = next((r for r in cal if r["round"] == round_num), None)
            if race and race.get("date"):
                race_ts = pd.Timestamp(race["date"])
                # Map our session_type strings to OpenF1 session_type values
                type_map = {
                    "Practice 1": "Practice", "Practice 2": "Practice",
                    "Practice 3": "Practice", "Race": "Race", "Qualifying": "Qualifying",
                }
                of1_type = type_map.get(session_type, session_type)
                candidates = [
                    s for s in sessions
                    if s.get("session_type") == of1_type
                    and s.get("date_start")
                    and 0 <= (race_ts - pd.Timestamp(s["date_start"][:10])).days <= 4
                ]
                # For Practice sessions, pick by index (P1=first, P2=second, P3=third)
                if of1_type == "Practice" and candidates:
                    candidates = sorted(candidates, key=lambda s: s.get("date_start", ""))
                    idx_map = {"Practice 1": 0, "Practice 2": 1, "Practice 3": 2}
                    idx = idx_map.get(session_type, 0)
                    if idx < len(candidates):
                        target = [candidates[idx]]
                elif candidates:
                    target = [candidates[0]]
        except Exception:
            pass

    if not target:
        return pd.DataFrame()
    session_key = target[0]["session_key"]
    laps_raw = get_openf1_laps(session_key)
    if not laps_raw:
        return pd.DataFrame()
    df = pd.DataFrame(laps_raw)
    drivers = get_openf1_drivers(session_key)
    driver_map = {d["driver_number"]: d.get("name_acronym", str(d["driver_number"])) for d in drivers}
    df["driverCode"] = df["driver_number"].map(driver_map)
    df["season"] = year
    df["round"] = round_num
    return df


def get_fp_pace(year: int, round_num: int, session_type: str = "Practice 2") -> pd.DataFrame:
    """
    Return best lap time per driver in a practice session as a DataFrame
    with columns: driverCode, best_lap_ms, pace_delta_pct
    """
    df = get_session_laps(year, round_num, session_type)
    if df.empty or "lap_duration" not in df.columns:
        return pd.DataFrame()
    df["lap_duration"] = pd.to_numeric(df["lap_duration"], errors="coerce")
    df = df.dropna(subset=["lap_duration"])
    best = df.groupby("driverCode")["lap_duration"].min().reset_index()
    best.columns = ["driverCode", "best_lap_ms"]
    pole_time = best["best_lap_ms"].min()
    best["fp_pace_delta_pct"] = (best["best_lap_ms"] - pole_time) / pole_time * 100
    return best


def _long_run_from_session_fastf1(year: int, round_num: int, session_name: str, min_stint_laps: int = 5) -> pd.DataFrame:
    """
    Extract long-run pace and tire degradation from any FastF1 practice session.
    Shared by FP2 (normal weekends) and FP1 (sprint weekends, where teams do race sims).
    Raises on any failure so the caller can fall back.
    """
    import numpy as np
    import fastf1
    import warnings
    warnings.filterwarnings("ignore")

    cache_dir = Path(__file__).parent.parent / "data" / "fastf1_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    session = fastf1.get_session(year, round_num, session_name)
    session.load(laps=True, telemetry=False, weather=False, messages=False)
    laps = session.laps

    if laps.empty:
        raise ValueError(f"FastF1 returned empty laps for {session_name}")

    laps = laps.copy()
    laps["lap_duration"] = laps["LapTime"].dt.total_seconds()
    laps = laps.rename(columns={"Driver": "driverCode", "LapNumber": "lap_number", "Stint": "stint_id"})

    laps = laps[laps["PitOutTime"].isna()]
    laps = laps.dropna(subset=["lap_duration"])

    def drop_outliers(g):
        med = g["lap_duration"].median()
        return g[g["lap_duration"] <= med * 1.07]

    laps = laps.groupby("driverCode", group_keys=False).apply(drop_outliers)

    def best_long_run_stats(group):
        best_pace, best_deg = None, None
        for _, stint in group.groupby("stint_id"):
            if len(stint) < min_stint_laps:
                continue
            core = stint.sort_values("lap_number").iloc[2:]
            median = core["lap_duration"].median()
            if best_pace is None or median < best_pace:
                best_pace = median
                times = core["lap_duration"].values
                slope = np.polyfit(range(len(times)), times, 1)[0]
                best_deg = slope / median * 100
        return pd.Series({"best_lap_ms": best_pace, "fp2_tire_deg_pct": best_deg})

    result = (
        laps.groupby("driverCode")
        .apply(best_long_run_stats, include_groups=False)
        .reset_index()
    )
    result = result[result["best_lap_ms"].notna()]

    if result.empty or len(result) < 5:
        raise ValueError(f"Insufficient long-run data from {session_name}")

    fastest = result["best_lap_ms"].min()
    result["fp_pace_delta_pct"] = (result["best_lap_ms"] - fastest) / fastest * 100
    return result[["driverCode", "best_lap_ms", "fp_pace_delta_pct", "fp2_tire_deg_pct"]]


def _fp2_long_run_fastf1(year: int, round_num: int) -> pd.DataFrame:
    return _long_run_from_session_fastf1(year, round_num, "FP2", min_stint_laps=5)


def _fp2_long_run_from_sprint_fastf1(year: int, round_num: int) -> pd.DataFrame:
    """
    Sprint weekend fallback: use sprint race laps as race-representative pace proxy.
    Sprint laps are actual race-condition data — far better than FP1 best laps.
    Uses a relaxed minimum stint length of 3 (sprint is only 17 laps).
    Raises on any failure so the caller can fall back further.
    """
    import numpy as np
    import fastf1
    import warnings
    warnings.filterwarnings("ignore")

    cache_dir = Path(__file__).parent.parent / "data" / "fastf1_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    session = fastf1.get_session(year, round_num, "Sprint")
    session.load(laps=True, telemetry=False, weather=False, messages=False)
    laps = session.laps

    if laps.empty:
        raise ValueError("FastF1 returned empty sprint laps")

    laps = laps.copy()
    laps["lap_duration"] = laps["LapTime"].dt.total_seconds()
    laps = laps.rename(columns={"Driver": "driverCode", "LapNumber": "lap_number", "Stint": "stint_id"})

    # Drop pit-out laps and SC/VSC-influenced laps (>10% over median)
    laps = laps[laps["PitOutTime"].isna()]
    laps = laps.dropna(subset=["lap_duration"])

    def drop_outliers(g):
        med = g["lap_duration"].median()
        return g[g["lap_duration"] <= med * 1.10]

    laps = laps.groupby("driverCode", group_keys=False).apply(drop_outliers)

    def best_long_run_stats(group):
        best_pace, best_deg = None, None
        for _, stint in group.groupby("stint_id"):
            if len(stint) < 3:  # relaxed from 5 — sprint races are only 17 laps
                continue
            core = stint.sort_values("lap_number").iloc[1:]  # drop first outlap
            median = core["lap_duration"].median()
            if best_pace is None or median < best_pace:
                best_pace = median
                times = core["lap_duration"].values
                slope = np.polyfit(range(len(times)), times, 1)[0] if len(times) >= 2 else 0.0
                best_deg = slope / median * 100
        return pd.Series({"best_lap_ms": best_pace, "fp2_tire_deg_pct": best_deg})

    result = (
        laps.groupby("driverCode")
        .apply(best_long_run_stats, include_groups=False)
        .reset_index()
    )
    result = result[result["best_lap_ms"].notna()]

    if result.empty or len(result) < 5:
        raise ValueError("Insufficient sprint long-run data from FastF1")

    fastest = result["best_lap_ms"].min()
    result["fp_pace_delta_pct"] = (result["best_lap_ms"] - fastest) / fastest * 100
    return result[["driverCode", "best_lap_ms", "fp_pace_delta_pct", "fp2_tire_deg_pct"]]


def get_fp2_long_run_pace(year: int, round_num: int) -> pd.DataFrame:
    """
    Extract race-representative pace and tire degradation from FP2 long runs.
    Primary source: FastF1 FP2 (clean stint IDs, proper pit detection).
    Sprint fallback: FastF1 sprint race laps (real race-condition data, better than FP1 best laps).
    Final fallback: OpenF1 raw laps with manual stint detection.
    Returns per driver:
      fp_pace_delta_pct  — best long-run median, % delta from fastest (lower = faster)
      fp2_tire_deg_pct   — degradation rate of best long-run, % per lap (lower = better management)
    """
    import numpy as np

    # Try FastF1 FP2 first — cleaner data, proper stint detection
    try:
        return _fp2_long_run_fastf1(year, round_num)
    except Exception:
        pass

    # Sprint weekend fallback: FP1 long runs (teams do race simulations in FP1 on sprint
    # weekends since there is no FP2/FP3 — gives real tire deg with correct sign)
    try:
        return _long_run_from_session_fastf1(year, round_num, "FP1", min_stint_laps=5)
    except Exception:
        pass

    # Sprint race laps fallback: real race-condition pace (deg omitted — track rubbering-in
    # produces negative slopes in a 17-lap sprint, which is track evolution not tire wear)
    try:
        return _fp2_long_run_from_sprint_fastf1(year, round_num)
    except Exception:
        pass

    # Final fallback: OpenF1 raw laps
    df = get_session_laps(year, round_num, "Practice 2")
    if df.empty or "lap_duration" not in df.columns:
        return pd.DataFrame()

    df = df.copy()
    df["lap_duration"] = pd.to_numeric(df["lap_duration"], errors="coerce")
    df = df[df["lap_duration"].notna()]

    df = df.sort_values(["driverCode", "lap_number"])
    df["_prev_was_pit"] = (
        (df["driverCode"] == df["driverCode"].shift(1)) &
        (df["is_pit_out_lap"].shift(1) == True)
    )
    df = df[df["is_pit_out_lap"] == False]

    def drop_outliers(g):
        med = g["lap_duration"].median()
        return g[g["lap_duration"] <= med * 1.07]

    df = df.groupby("driverCode", group_keys=False).apply(drop_outliers)

    def best_long_run_stats(group):
        group = group.sort_values("lap_number").reset_index(drop=True)
        gap_break = group["lap_number"].diff().fillna(1) > 2
        pit_break = group["_prev_was_pit"].fillna(False)
        group["stint"] = (gap_break | pit_break).cumsum()
        best_pace, best_deg = None, None
        for _, stint in group.groupby("stint"):
            if len(stint) < 5:
                continue
            core = stint.iloc[2:]
            median = core["lap_duration"].median()
            if best_pace is None or median < best_pace:
                best_pace = median
                laps = core["lap_duration"].values
                slope = np.polyfit(range(len(laps)), laps, 1)[0]
                best_deg = slope / median * 100
        return pd.Series({"best_lap_ms": best_pace, "fp2_tire_deg_pct": best_deg})

    result = (
        df.groupby("driverCode")
        .apply(best_long_run_stats, include_groups=False)
        .reset_index()
    )
    result = result[result["best_lap_ms"].notna()]

    if result.empty or len(result) < 5:
        return pd.DataFrame()

    fastest = result["best_lap_ms"].min()
    result["fp_pace_delta_pct"] = (result["best_lap_ms"] - fastest) / fastest * 100
    return result[["driverCode", "best_lap_ms", "fp_pace_delta_pct", "fp2_tire_deg_pct"]]


def get_weather_forecast(session_key: int) -> dict:
    """Return latest weather reading for a session."""
    weather = get_openf1_weather(session_key)
    if not weather:
        return {}
    latest = sorted(weather, key=lambda x: x.get("date", ""))[-1]
    return {
        "air_temperature": latest.get("air_temperature"),
        "track_temperature": latest.get("track_temperature"),
        "rainfall": latest.get("rainfall", False),
        "wind_speed": latest.get("wind_speed"),
        "humidity": latest.get("humidity"),
    }


OPEN_METEO_BASE = "https://api.open-meteo.com/v1"


def get_weather_forecast_for_race(lat: float, lon: float, race_datetime_utc: str) -> dict | None:
    """
    Fetch hourly weather forecast from Open-Meteo for the race start time.
    Returns {'is_raining': 0|1, 'track_temp_celsius': float} or None on failure.

    Track temperature is estimated from air temp and cloud cover:
      track_temp = air_temp + 7 + 18 * (1 - cloud_fraction)
    Calibrated on Miami 2026 weekend data:
      - Overcast (100% cloud): air=27.7°C → track≈34.7°C (matches live 34.85°C)
      - Clear sky (0% cloud):  air=30°C   → track≈55°C   (matches practice 52-57°C)
    """
    try:
        race_date = race_datetime_utc[:10]
        url = f"{OPEN_METEO_BASE}/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,precipitation,cloudcover",
            "timezone": "UTC",
            "start_date": race_date,
            "end_date": race_date,
        }
        data = _cached_get(url, params=params, ttl_hours=2)
        if not data or "hourly" not in data:
            return None

        hourly = data["hourly"]
        race_hour = race_datetime_utc[:13]  # "YYYY-MM-DDTHH"
        # Find closest hour
        idx = None
        for i, t in enumerate(hourly["time"]):
            if t.startswith(race_hour):
                idx = i
                break
        if idx is None:
            idx = 0  # fallback to first reading of race day

        air_temp = hourly["temperature_2m"][idx]
        cloudcover = hourly["cloudcover"][idx]
        precip = hourly["precipitation"][idx]

        cloud_fraction = max(0.0, min(1.0, cloudcover / 100.0))
        track_temp = air_temp + 7 + 18 * (1 - cloud_fraction)
        is_raining = int(precip > 0.1)

        return {"is_raining": is_raining, "track_temp_celsius": round(track_temp, 1)}
    except Exception:
        return None


def get_race_weather(
    year: int,
    round_num: int,
    race_date: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    race_datetime_utc: str | None = None,
) -> dict:
    """
    Return weather conditions for a race. Priority order:
      1. Live race session data from OpenF1 (race has started)
      2. Open-Meteo forecast for race start time (lat/lon + race_datetime_utc required)
      3. Sprint/qualifying session from the same weekend (same circuit, close conditions)
      4. Hardcoded default

    race_date: YYYY-MM-DD used for date-proximity session matching.
    lat/lon + race_datetime_utc: enables weather forecast for upcoming races.
    """
    _DEFAULT = {"is_raining": 0, "track_temp_celsius": 30.0}
    try:
        sessions = get_openf1_sessions(year)
        if not sessions:
            return _DEFAULT

        # Try matching by round_number (works for 2023-2025)
        race_sessions = [s for s in sessions if s.get("session_type") == "Race"]
        target = [s for s in race_sessions if s.get("round_number") == round_num]

        # If race_date provided, find the Race session closest to that date.
        # This is more reliable than round index when round_number=None (2026).
        # Use string prefix comparison to avoid timezone-aware/naive pd.Timestamp issues.
        if not target and race_date:
            race_sessions_sorted = sorted(race_sessions, key=lambda x: x.get("date_start", ""))
            best = min(race_sessions_sorted, key=lambda s: abs(
                (pd.Timestamp(s["date_start"][:10]) - pd.Timestamp(race_date[:10])).total_seconds()
            ), default=None)
            if best:
                target = [best]

        # Final fallback: round index (may miscount on sprint weekends)
        if not target:
            race_sessions_sorted = sorted(race_sessions, key=lambda x: x.get("date_start", ""))
            if round_num <= len(race_sessions_sorted):
                target = [race_sessions_sorted[round_num - 1]]

        if not target:
            return _DEFAULT

        def _extract_weather(session_key: int) -> dict | None:
            try:
                weather = get_openf1_weather(session_key)
                if not weather:
                    return None
                sample = sorted(weather, key=lambda x: x.get("date", ""))[:10]
                is_raining = int(any(w.get("rainfall", False) for w in sample))
                temps = [w["track_temperature"] for w in sample if w.get("track_temperature") is not None]
                track_temp = float(sum(temps) / len(temps)) if temps else None
                if track_temp is None:
                    return None
                return {"is_raining": is_raining, "track_temp_celsius": track_temp}
            except Exception:
                return None

        # Try race session first (most accurate — actual race conditions)
        result = _extract_weather(target[0]["session_key"])
        if result:
            return result

        # Race hasn't started — try Open-Meteo forecast for the exact race start time/location
        if lat is not None and lon is not None and race_datetime_utc:
            forecast = get_weather_forecast_for_race(lat, lon, race_datetime_utc)
            if forecast:
                return forecast

        # Fall back to the best available session from the same weekend.
        # Only consider sessions within 3 days before race day.
        # Prefer Sprint Race (same 4pm start time) over Qualifying (evening).
        if race_date:
            race_session_key = target[0]["session_key"]
            race_ts = pd.Timestamp(race_date[:10])
            weekend_sessions = [
                s for s in sessions
                if s.get("session_key") != race_session_key
                and 0 <= (race_ts - pd.Timestamp(s["date_start"][:10])).days <= 3
            ]
            # Sprint Race sessions first (same time of day as race), then everything else by date proximity
            sprint_races = [s for s in weekend_sessions if s.get("session_type") == "Race"]
            others = [s for s in weekend_sessions if s.get("session_type") != "Race"]
            others_sorted = sorted(others, key=lambda s: abs((pd.Timestamp(s["date_start"][:10]) - race_ts).days))
            for candidate in sprint_races + others_sorted:
                result = _extract_weather(candidate["session_key"])
                if result:
                    return result

        return _DEFAULT
    except Exception:
        return _DEFAULT
