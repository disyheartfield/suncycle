import { useEffect, useState } from "react";
import { searchLocations } from "../api";

// Each effect owns its request. Cleanup rejects late results even if abort is ignored.
export function useLocationSearch(text, enabled) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ text: "", status: "idle", items: [], error: "" });

  useEffect(() => {
    if (!enabled || text.trim().length < 3) return undefined;
    let active = true;
    const controller = new AbortController();
    setResult({ text, status: "loading", items: [], error: "" });
    const timer = setTimeout(async () => {
      try {
        const items = await searchLocations(text, { signal: controller.signal });
        if (active) setResult({ text, status: "done", items, error: "" });
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setResult({ text, status: "error", items: [], error: error.message });
        }
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, enabled, retry]);

  const visible = enabled && text.trim().length >= 3;
  const current = visible && result.text === text
    ? result
    : { status: visible ? "loading" : "idle", items: [], error: "" };
  return { ...current, retry: () => setRetry(value => value + 1) };
}
