"""Find UK locations with Geoapify and cycling routes with GraphHopper."""

import math
import re
from dataclasses import dataclass

import requests
from shapely.geometry import LineString


class RoutingError(Exception):
    """A safe message for the app, without request URLs or API keys."""

    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


def _get_json(url, service, params=None, timeout=(5, 20)):
    try:
        response = requests.get(url, params=params, timeout=timeout)
        if response.status_code in (401, 403):
            raise RoutingError(f"{service} access was refused. Check its backend API key and restrictions.", 503)
        if response.status_code == 429:
            raise RoutingError(f"{service} request limit reached. Please try again later.", 429)
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        raise RoutingError(f"{service} timed out. Please try again.", 504) from None
    except requests.RequestException:
        raise RoutingError(f"Could not reach {service}. Check your connection and service access.") from None
    except ValueError:
        raise RoutingError(f"{service} returned an unreadable response.") from None


def _coordinate(lat, lng):
    lat, lng = float(lat), float(lng)
    if not (math.isfinite(lat) and math.isfinite(lng) and abs(lat) <= 90 and abs(lng) <= 180):
        raise ValueError("Invalid coordinate")
    return lat, lng


# Recognises complete UK postcodes, including GIR 0AA. Existence is checked by Geoapify.
POSTCODE = re.compile(r"(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})")


def search_locations(text, api_key):
    """Return a small, consistent selection list. Postcodes are optional metadata."""
    text = " ".join(text.split())
    if len(text) < 3:
        return []
    compact = re.sub(r"\s+", "", text).upper()
    full_postcode = bool(POSTCODE.fullmatch(compact))
    params = {
        "text": text, "apiKey": api_key, "format": "json", "lang": "en",
        "filter": "countrycode:gb", "bias": "proximity:-0.1276,51.5072", "limit": 5,
    }
    # A complete typed postcode is resolved exactly, so the existing shortcut works.
    endpoint = "search" if full_postcode else "autocomplete"
    if full_postcode:
        params.update(text=f"{compact[:-3]} {compact[-3:]}", type="postcode")
    data = _get_json(
        f"https://api.geoapify.com/v1/geocode/{endpoint}", "Geoapify",
        params=params, timeout=(3, 8),
    )
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise RoutingError("Geoapify returned an unreadable location list.")

    results, seen = [], set()
    for item in data["results"]:
        if not isinstance(item, dict) or item.get("country_code") != "gb":
            continue
        kind = item.get("result_type")
        # City/country centres are too broad to use as a cycling destination.
        if kind not in {"amenity", "building", "street", "postcode"}:
            continue
        postcode = item.get("postcode")
        postcode = postcode if isinstance(postcode, str) else None
        if kind == "postcode" and not POSTCODE.fullmatch(re.sub(r"\s+", "", postcode or "").upper()):
            continue
        if full_postcode and (kind != "postcode" or re.sub(r"\s+", "", postcode or "").upper() != compact):
            continue
        try:
            lat, lng = _coordinate(item["lat"], item["lon"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        label = item.get("formatted")
        if not isinstance(label, str) or not label.strip():
            continue
        title = item.get("name") or item.get("address_line1") or label
        title = title if isinstance(title, str) else label
        identity = (label, lat, lng)
        if identity in seen:
            continue
        seen.add(identity)
        results.append({
            "id": str(item.get("place_id") or f"{lat},{lng}:{label}"),
            "label": label, "title": title, "postcode": postcode,
            "latitude": lat, "longitude": lng, "type": kind,
        })
    return results[:5]


@dataclass
class Route:
    id: str
    coordinates: list[tuple[float, float]]  # (latitude, longitude)
    distance_m: float
    duration_s: float


def fetch_routes(start, end, api_key):
    """Ask GraphHopper for up to three cycling alternatives."""
    data = _get_json("https://graphhopper.com/api/1/route", "GraphHopper", params={
        "point": [f"{start[0]},{start[1]}", f"{end[0]},{end[1]}"],
        "profile": "bike",
        "algorithm": "alternative_route",
        "alternative_route.max_paths": 3,
        "alternative_route.max_weight_factor": 1.6,
        "alternative_route.max_share_factor": 0.6,
        "points_encoded": "false",
        "key": api_key,
    })
    try:
        routes = []
        for i, path in enumerate(data["paths"]):
            coords = [_coordinate(point[1], point[0]) for point in path["points"]["coordinates"]]
            distance, duration = float(path["distance"]), float(path["time"]) / 1000
            if len(coords) < 2 or not all(math.isfinite(v) and v > 0 for v in (distance, duration)):
                raise ValueError("Invalid route")
            routes.append(Route(f"route_{i}", coords, distance, duration))
        if not routes:
            raise RoutingError("No cycling route found between these locations.", 404)
        return routes
    except (KeyError, IndexError, TypeError, ValueError):
        raise RoutingError("GraphHopper returned invalid route data.") from None


def sample_points(route, count=120):
    """Preserve the app's sampling: 120 points spaced along the lon/lat line.

    Spacing is in coordinate degrees, not exact metres. Both endpoints remain.
    ShadeMap counts these samples; sending uneven raw vertices would bias it.
    """
    if count < 2:
        raise ValueError("At least two sample points are required")
    line = LineString([(lng, lat) for lat, lng in route.coordinates])
    if line.length == 0:
        raise RoutingError("The route has no usable length. Try different locations.", 400)
    points = [line.interpolate(i * line.length / (count - 1)) for i in range(count)]
    return [[point.x, point.y] for point in points]  # app expects [longitude, latitude]
