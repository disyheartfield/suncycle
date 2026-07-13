# ☀ SunCycle

Sun-aware cycling route app for London. Finds the sunniest cycling route between two UK postcodes using real solar position data and building shadow simulation.

## Architecture

**Backend** (`~/Downloads/suncycle/`) — Python/FastAPI, must be running separately.

Start it with:

    source ~/suncycle-env/bin/activate
    cd ~/Downloads/suncycle
    uvicorn server:app --reload --port 8001

**App** (this repo) — React Native/Expo SDK 56.

Run it with:

    npm install
    npx expo run:ios

Add your own API keys to `src/config.js` (copy from `src/config.example.js`).

## The problem needing expert attention

`src/components/ShadingWebView.js` is a hidden WebView running Mapbox GL JS + `mapbox-gl-shadow-simulator`. It scores each route point using `isPositionInSun(x, y)` from the ShadeMap library.

**Symptom:** `isPositionInSun` returns `true` for every point regardless of time of day, building density, or sun position. All routes score 100%. Worked twice giving real variation (42%/37%/55% and 86%/100%/79%) but could not be reproduced.

**Suspected causes:**

1. iOS WebGL throttling — GPU context is being throttled for off-screen WebViews even with opacity > 0
2. `idle` event timing — ShadeMap fires `idle` before the GPU has actually written the shadow texture to canvas
3. Library version — loaded unpinned from unpkg, may have changed between sessions

**What would help most:**

- Get Safari Web Inspector connected to the WebView (`webviewDebuggingEnabled={true}` is already set in the component)
- Test `shadeMap.isPositionInSun(200, 300)` directly in the Safari console against the live ShadeMap instance
- Test the WebView HTML as a standalone file in desktop Safari to rule out iOS-specific throttling

## Tech stack

- React Native + Expo SDK 56
- Mapbox GL JS v2.15.0
- mapbox-gl-shadow-simulator (ShadeMap)
- GraphHopper API (cycling routes)
- postcodes.io (UK geocoding, free, no auth)
- FastAPI + uvicorn (Python backend)
