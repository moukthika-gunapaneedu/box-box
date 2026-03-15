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
                result.append({
                    "season": year,
                    "round": int(r["round"]),
                    "name": r["raceName"],
                    "circuit": r["Circuit"]["circuitName"],
                    "country": r.get("Circuit", {}).get("Location", {}).get("country", ""),
                    "locality": r.get("Circuit", {}).get("Location", {}).get("locality", ""),
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
    sessions = get_openf1_sessions(year)
    target = [s for s in sessions if s.get("session_type") == session_type and s.get("round_number") == round_num]
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


def get_race_weather(year: int, round_num: int) -> dict:
    """
    Return aggregated weather conditions for a race session.
    Returns: {'is_raining': 0|1, 'track_temp_celsius': float}
    Uses first ~10 weather readings to represent race start conditions.
    """
    _DEFAULT = {"is_raining": 0, "track_temp_celsius": 30.0}
    try:
        sessions = get_openf1_sessions(year)
        race_sessions = [s for s in sessions if s.get("session_type") == "Race"]
        if not race_sessions:
            return _DEFAULT

        # Try matching by round_number (works for 2023-2025)
        target = [s for s in race_sessions if s.get("round_number") == round_num]

        # Fallback: sort by date and use round index (handles 2026 where round_number=None)
        if not target:
            race_sessions_sorted = sorted(race_sessions, key=lambda x: x.get("date_start", ""))
            if round_num <= len(race_sessions_sorted):
                target = [race_sessions_sorted[round_num - 1]]

        if not target:
            return _DEFAULT

        session_key = target[0]["session_key"]
        weather = get_openf1_weather(session_key)
        if not weather:
            return _DEFAULT

        # Use first 10 readings (race start conditions)
        sample = sorted(weather, key=lambda x: x.get("date", ""))[:10]
        is_raining = int(any(w.get("rainfall", False) for w in sample))
        temps = [w["track_temperature"] for w in sample if w.get("track_temperature") is not None]
        track_temp = float(sum(temps) / len(temps)) if temps else 30.0

        return {"is_raining": is_raining, "track_temp_celsius": track_temp}
    except Exception:
        return _DEFAULT
