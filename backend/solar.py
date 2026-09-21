"""Calculate the sun-position label shown above the app's map."""

import math
from datetime import timezone

import suncalc


def sun_position(lat, lng, departure):
    """Return compass direction and altitude; this does not score a route."""
    if departure.tzinfo is None or departure.utcoffset() is None:
        raise ValueError("Departure must include a timezone")
    position = suncalc.get_position(departure.astimezone(timezone.utc), lng, lat)
    azimuth = (math.degrees(position["azimuth"]) + 180) % 360
    altitude = math.degrees(position["altitude"])
    compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return {
        "azimuth": round(azimuth, 1),
        "altitude": round(altitude, 1),
        "compass": compass[round(azimuth / 45) % 8],
    }
