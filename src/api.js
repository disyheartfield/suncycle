// api.js — SunCycle backend client
// Replace BASE_URL with your Mac's local IP when testing on a real phone
// On simulator: localhost works fine

const BASE_URL = "http://127.0.0.1:8001";

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200000); // 60s — Overpass can be slow

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new APIError(err.detail || "Request failed", res.status);
    }

    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      throw new APIError("Request timed out — building data can take up to 60s", 408);
    }
    throw e;
  }
}

/**
 * Fetch sunniest cycling routes between two postcodes.
 * @param {string} start - UK postcode e.g. "N19 3DA"
 * @param {string} end - UK postcode e.g. "SE1 7PB"
 * @param {string|Date|null} departureAt - ISO timestamp/Date, or null for now
 */
export async function fetchRoutes(start, end, departureAt = null) {
  const departure = departureAt ? new Date(departureAt) : new Date();
  if (Number.isNaN(departure.getTime())) {
    throw new APIError("Invalid departure time", 400);
  }

  const departureTime = [departure.getHours(), departure.getMinutes()]
    .map(value => String(value).padStart(2, "0"))
    .join(":");

  const data = await request("/routes", {
    method: "POST",
    body: JSON.stringify({
      start: start.trim().toUpperCase(),
      end: end.trim().toUpperCase(),
      departure_time: departureTime,
    }),
  });

  // The backend currently accepts HH:MM. Preserve the exact timestamp chosen
  // on the device so ShadeMap and every frontend consumer use one instant.
  return {
    ...data,
    departure_at: departure.toISOString(),
  };
}

export async function healthCheck() {
  return request("/health");
}