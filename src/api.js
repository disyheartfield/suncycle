// Set EXPO_PUBLIC_API_URL in the frontend .env for a real phone.
// Or keep your existing working BASE_URL here. This URL is not an API key.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

async function request(path, { signal, timeoutMs = 45000, ...options } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof data?.detail === "string"
        ? data.detail
        : "The server could not use these locations. Choose them again and retry.";
      throw new APIError(message, response.status);
    }
    if (!data) throw new APIError("The server returned an unreadable response.", 502);
    return data;
  } catch (error) {
    if (signal?.aborted) {
      const cancelled = new Error("Request cancelled");
      cancelled.name = "AbortError";
      throw cancelled;
    }
    if (timedOut) throw new APIError("The request timed out. Please try again.", 408);
    if (error instanceof APIError) throw error;
    throw new APIError("Can't reach the server. Check it is running and the backend URL is correct.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude)
    && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180;
}

export async function searchLocations(text, { signal } = {}) {
  const query = text.trim();
  if (query.length < 3) return [];
  const data = await request(`/locations/search?text=${encodeURIComponent(query)}`, {
    signal, timeoutMs: 15000,
  });
  if (!Array.isArray(data.results)) throw new APIError("The server returned an unreadable location list.", 502);
  return data.results.filter(place => hasCoordinates(place)
    && typeof place.label === "string" && typeof place.title === "string");
}

const compactPostcode = text => text.replace(/\s+/g, "").toUpperCase();
const POSTCODE = /^(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/;

export async function resolveLocation(text, selected, { signal } = {}) {
  if (selected?.label === text && hasCoordinates(selected)) return selected;
  const postcode = compactPostcode(text);
  if (!POSTCODE.test(postcode)) {
    throw new APIError("Choose an address from the suggestions, or enter a full UK postcode.", 400);
  }
  // Exact postcode matching only: never silently choose the first place-name result.
  const results = await searchLocations(text, { signal });
  const match = results.find(place => place.type === "postcode"
    && compactPostcode(place.postcode || "") === postcode);
  if (!match) throw new APIError(`Couldn't find ${text.trim()}. Check the postcode or choose an address instead.`, 400);
  return match;
}

export async function fetchRoutes(start, end, departureAt = null, { signal } = {}) {
  if (!hasCoordinates(start) || !hasCoordinates(end)) {
    throw new APIError("Choose both locations before searching for routes.", 400);
  }
  const departure = departureAt === null ? new Date() : new Date(departureAt);
  if (Number.isNaN(departure.getTime())) throw new APIError("Invalid departure time", 400);
  const coordinates = place => ({ latitude: place.latitude, longitude: place.longitude });
  const data = await request("/routes", {
    signal,
    method: "POST",
    body: JSON.stringify({
      start: coordinates(start), end: coordinates(end),
      departure_at: departure.toISOString(),
    }),
  });
  // Keep exactly the same instant for ShadeMap, including when postcode lookup was slow.
  return { ...data, departure_at: departure.toISOString() };
}

export async function healthCheck() {
  return request("/health", { timeoutMs: 5000 });
}
