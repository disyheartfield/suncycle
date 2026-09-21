"""SunCycle API: routes from GraphHopper; sunlight scoring stays in the app.

From the repository root: npm run backend
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .routing import RoutingError, fetch_routes, search_locations, sample_points
from .solar import sun_position

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
GRAPHHOPPER_API_KEY = os.getenv("GRAPHHOPPER_API_KEY", "").strip()
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "").strip()
if not GRAPHHOPPER_API_KEY or GRAPHHOPPER_API_KEY == "replace_with_your_graphhopper_api_key":
    raise RuntimeError("Set GRAPHHOPPER_API_KEY in the root .env file, then restart.")

LONDON = ZoneInfo("Europe/London")
app = FastAPI(title="SunCycle API", version="3.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class Location(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class RouteRequest(BaseModel):
    start: Location
    end: Location
    departure_time: Optional[str] = None  # legacy app: HH:MM, today in London
    departure_at: Optional[str] = None  # preferred: ISO timestamp with timezone


def parse_departure(req):
    """An explicit timestamp takes precedence over the older time-only input."""
    try:
        if req.departure_at is not None:
            departure = datetime.fromisoformat(req.departure_at.replace("Z", "+00:00"))
            if departure.tzinfo is None or departure.utcoffset() is None:
                raise ValueError()
            return departure.astimezone(LONDON)
        departure = datetime.now(LONDON)
        if req.departure_time is not None:
            if not re.fullmatch(r"\d{2}:\d{2}", req.departure_time):
                raise ValueError()
            hour, minute = map(int, req.departure_time.split(":"))
            departure = departure.replace(hour=hour, minute=minute, second=0, microsecond=0)
        return departure
    except ValueError:
        raise HTTPException(400, "Use HH:MM for departure_time, or an ISO departure_at with a timezone.") from None


@app.post("/routes")
def get_routes(req: RouteRequest):
    # A normal def lets FastAPI run the blocking HTTP calls in its thread pool.
    departure = parse_departure(req)
    try:
        start = (req.start.latitude, req.start.longitude)
        end = (req.end.latitude, req.end.longitude)
        routes = fetch_routes(start, end, GRAPHHOPPER_API_KEY)
        fastest = min(routes, key=lambda route: route.duration_s).id
        result = [{
            "id": route.id,
            "distance_km": round(route.distance_m / 1000, 1),
            "duration_min": round(route.duration_s / 60),
            "sun_percent": None,
            "sunny_km": None,
            "score": None,
            "description": "Calculating sunlight…",
            "is_sunniest": False,
            "is_fastest": route.id == fastest,
            "segments": [{"coordinates": sample_points(route), "in_sun": None}],
        } for route in routes]
    except RoutingError as error:
        raise HTTPException(error.status_code, str(error)) from None

    return {
        "routes": result,
        "sunlight_status": "pending",
        "sun_position": sun_position((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, departure),
        "departure_time": departure.strftime("%H:%M"),
        "departure_at": departure.isoformat(),
        "start_coords": list(start),
        "end_coords": list(end),
    }


@app.get("/locations/search")
def locations(text: str = Query(min_length=3, max_length=200)):
    if not GEOAPIFY_API_KEY or GEOAPIFY_API_KEY.startswith("replace_with_"):
        raise HTTPException(503, "Set GEOAPIFY_API_KEY in the root .env file, then restart.")
    try:
        return {"results": search_locations(text, GEOAPIFY_API_KEY)}
    except RoutingError as error:
        raise HTTPException(error.status_code, str(error)) from None


@app.get("/health")
def health():
    return {"status": "ok", "service": "SunCycle API"}
