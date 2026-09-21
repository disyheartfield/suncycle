# ☀️ SunCycle

SunCycle compares up to three cycling routes and estimates how much of each route will be in direct sunlight at your selected departure time. Sunny sections appear yellow and shaded sections blue. It is a development prototype, not a production navigation app.

The Expo / React Native app and FastAPI backend now live in this one repository. Keep all local credentials and the backend address in **one root `.env`**, copied from `.env.example`. There is no `src/config.js` to create or edit.

## What you need

- Node.js 20.19+ and npm ([Expo SDK 56 requirements](https://docs.expo.dev/versions/v56.0.0/)).
- Python 3.10+ (the existing backend uses Python 3.10 type syntax).
- Xcode 26.4+ on macOS for iOS Simulator; Android Studio / Android SDK for Android.
- Git or GitHub Desktop and internet access.
- [GraphHopper key](https://graphhopper.com/dashboard/), [Geoapify key](https://myprojects.geoapify.com/), [Mapbox public token](https://account.mapbox.com/access-tokens/) starting with `pk.`, and a [ShadeMap browser API key](https://shademap.app/).

## First-time setup

Download or clone this combined repository. Open a terminal in the **main project folder**: the folder containing `package.json`, `.env.example` and `backend/`. Run the commands below from that folder, not from inside `backend/`.

The commands below use macOS/Linux terminal syntax. Building for iOS requires macOS and Xcode.

### 1. Add your API credentials

If you do not already have a root `.env`, create it from the template:

```bash
cp .env.example .env
```

If `.env` already exists, keep it; do not overwrite your existing credentials.

Open `.env` in your editor and fill in:

- `GRAPHHOPPER_API_KEY` — your GraphHopper key.
- `GEOAPIFY_API_KEY` — your Geoapify key.
- `EXPO_PUBLIC_MAPBOX_TOKEN` — your Mapbox public token, starting with `pk.`.
- `EXPO_PUBLIC_SHADEMAP_KEY` — your ShadeMap browser API key.

The provider links are listed under **What you need** above. For iOS Simulator, leave:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8001
```

For a phone or Android emulator, use the address described under **Simulator and device addresses** below. All personal configuration goes in this one root `.env`; keep `.env.example` free of real credentials. There is no need to edit JavaScript or Python files to enter your keys or IP address.

### 2. Install the frontend dependencies

```bash
npm ci
```

### 3. Create the Python environment and install the backend dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install fastapi uvicorn requests shapely suncalc python-dotenv numpy
```

`.venv` holds this project's Python packages, including Uvicorn. After activation, your terminal will usually show `(.venv)` before the prompt. If your editor asks whether to select the newly created environment for this workspace, choose **Yes**.

On Windows PowerShell, use `python` if `python3` is unavailable, and activate the environment with `.\.venv\Scripts\Activate.ps1` instead.

### 4. Start the backend

In the same terminal, with `.venv` active, run:

```bash
python3 -m uvicorn backend.server:app --reload --host 0.0.0.0 --port 8001
```

Wait for:

```text
Application startup complete.
```

Keep this terminal running while using the app.

### 5. Start the frontend

Open a **second terminal** in the same main project folder. Check that the backend is reachable:

```bash
curl http://127.0.0.1:8001/health
```

Expected response:

```json
{"status":"ok","service":"SunCycle API"}
```

For the first iOS Simulator build, run:

```bash
npm run ios
```

For Android, use `npm run android` instead. The first native build, including installation of iOS dependencies through CocoaPods, can take several minutes. If you already have a compatible development version of the app installed, use the frontend command in **Starting the app again** below.

### 6. Try a route

Select a starting location and destination, choose **Now** or a departure time today, and press **Find Sunniest Route**. Compare the routes and their sunlight colouring. Initial requests can be slower while routing, building and shadow data load.

## Starting the app again

Open two terminals in the main project folder.

**Terminal 1 — activate the Python environment and start the backend:**

```bash
source .venv/bin/activate
python3 -m uvicorn backend.server:app --reload --host 0.0.0.0 --port 8001
```

**Terminal 2 — start Expo:**

```bash
npx expo start --clear
```

Press `i` for iOS Simulator or `a` for Android, or open your installed development app. Keep both terminals running. Press **Ctrl+C** in each terminal when finished.

You do not need to recreate `.venv` or reinstall dependencies for every session. Install dependencies again when their requirements change. A new native build is needed when native dependencies or native configuration change; JavaScript-only edits and changes to these `.env` values do not require one.

After changing `.env`, restart the backend and Expo and fully reload the app. Existing shell environment variables take precedence; unset stale values if changes seem ignored. Keep configuration in `.env` rather than adding `.env.local` overrides.

## Simulator and device addresses

Change only `EXPO_PUBLIC_API_URL` in the root `.env`:

| Target | Value |
| --- | --- |
| iOS Simulator on this Mac | `http://127.0.0.1:8001` |
| Standard Android emulator | `http://10.0.2.2:8001` |
| Physical iPhone or Android | `http://YOUR_MAC_WIFI_IP:8001` |

For a phone, use the Mac's current Wi-Fi IP (`ipconfig getifaddr en0` commonly shows it), keep port **8001**, and connect both devices to a network where they can reach each other. Keep Uvicorn bound to `0.0.0.0` and allow local access through the firewall. A physical iOS build also needs device signing setup (`npx expo run:ios --device`). `127.0.0.1` on a phone means the phone itself.

## How the sunlight percentage is calculated

1. GraphHopper returns up to three alternative cycling routes.
2. The backend resamples each route into 120 approximately equally spaced points.
3. A hidden WebView loads Mapbox building geometry, terrain and ShadeMap at the chosen departure time.
4. ShadeMap's `isPositionInSun` checks each route point.
5. SunCycle calculates:

   ```text
   sunny points ÷ total points × 100
   ```

For example, 115 sunny points out of 120 produce 95.8%, which the interface displays as 96%.

The result is an estimate of direct sunlight along the route centreline. It is not a measurement of every centimetre of the route.

## Current limitations

- Location search is limited to Great Britain (UK postcodes, streets and addresses via Geoapify).
- SunCycle compares GraphHopper's alternative routes; it does not search every possible street combination for a mathematically optimal sunny route.
- A selected time applies to today. There is not yet a separate date picker.
- Every route point is evaluated at the chosen departure time. The calculation does not yet advance the time as the cyclist travels.
- Building and terrain shadows are included, but tree-canopy shade is not currently modelled.
- The route centreline is tested rather than a particular side of the road or cycle lane.
- Follow mode displays position and phone direction but is not turn-by-turn navigation and does not reroute.
- The app requires an internet connection and access to its external services.

## Project structure and configuration

```text
.env.example              # The one template; copy to ignored .env
README.md                 # Setup for both parts
package.json              # Expo app and startup scripts
App.js
src/
  api.js                  # Reads EXPO_PUBLIC_API_URL
  components/
    ShadingWebView.js      # Reads the two public browser credentials
  screens/
backend/
  server.py               # Loads ../.env using its own file location
  routing.py              # Geoapify search and GraphHopper routes
  solar.py                # Sun-position label
```

Expo automatically loads the root `.env` because its project remains at the repository root, and inlines the three `EXPO_PUBLIC_*` values through direct `process.env.EXPO_PUBLIC_*` references ([Expo environment-variable documentation](https://docs.expo.dev/guides/environment-variables/)). No symlink, copy script, additional JavaScript dotenv dependency, or duplicated configuration file is needed. Python reads that same file regardless of the working directory. Deployment environments can also provide values directly.

Mapbox and ShadeMap browser credentials are public and included in the app; use provider restrictions appropriate to your app. GraphHopper and Geoapify keys stay backend-only and must never get an `EXPO_PUBLIC_` prefix. The ignored legacy `src/config.js` is no longer read. If a credential was previously exposed, revoke it; deleting a file does not remove Git history.

The root `.gitignore` should include:

```gitignore
.env*
!.env.example
.venv/
```

This keeps local credentials and the Python environment out of new commits while allowing the blank environment template to be shared. Ignore rules do not untrack files that were already committed.

## Troubleshooting

- **`No module named uvicorn`:** activate the root environment with `source .venv/bin/activate`. If it is a fresh environment, run the dependency installation command in step 3, then start the backend again.
- **`attempted relative import with no known parent package`:** run `python3 -m uvicorn backend.server:app --reload --host 0.0.0.0 --port 8001` from the main project folder. The backend uses package-relative imports, so use `backend.server:app` rather than `server:app --app-dir backend`.
- **Missing GraphHopper or Geoapify key:** confirm `.env` is in the repository root, not `backend/`, is plain text, and is not named `.env.txt`. Fill the relevant value and restart Uvicorn. Geoapify is required for location search.
- **401 / access refused:** check the relevant provider key and restrictions.
- **Cannot connect to port 8001:** start the backend, wait for startup, and check `/health`. For a phone, recheck the Mac's IP and Wi-Fi reachability.
- **`externally-managed-environment`:** activate `.venv` and reinstall; do not use `--break-system-packages`.
- **Missing map or shadow calculation:** check the two public credentials and reload Expo after editing `.env`.
- **iOS haptics / keyboard / VectorKit warnings:** investigate when accompanied by a visible failure, rather than treating every simulator warning as an app error.

## Technology

React Native / Expo SDK 56, Mapbox GL JS, ShadeMap (`mapbox-gl-shadow-simulator`), GraphHopper, Geoapify, FastAPI and Uvicorn.
