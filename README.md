# ☀️ SunCycle

SunCycle compares cycling routes between two UK postcodes and estimates how much of each route will be in direct sunlight at the time you leave.

Choose a departure time, compare up to three cycling routes, and see sunny sections in yellow and shaded sections in blue.

> **Current status:** SunCycle is a working development prototype. It is not yet a production navigation app.

## What SunCycle does

1. Converts two UK postcodes into coordinates.
2. Requests up to three cycling routes from GraphHopper.
3. Checks the routes against building and terrain shadows at the selected departure time.
4. Ranks the routes by their estimated percentage of direct sunlight.
5. Displays sunny sections in yellow and shaded sections in blue.

## What you need

Install the following before starting:

- [Node.js](https://nodejs.org/) and npm
- [Python 3.9 or newer](https://www.python.org/downloads/)
- [Xcode](https://developer.apple.com/xcode/) to use the iOS Simulator
- Git, or [GitHub Desktop](https://desktop.github.com/)

Create three development API credentials:

1. A [Mapbox public access token](https://account.mapbox.com/access-tokens/)
2. A [ShadeMap API key](https://shademap.app/about/)
3. A [GraphHopper API key](https://graphhopper.com/dashboard/)

You need both repositories:

- Frontend: <https://github.com/disyheartfield/suncycle>
- Backend: <https://github.com/disyheartfield/suncycle-backend>

## Setup

The easiest setup uses two Terminal windows: one for the Python backend and one for the Expo app.

### 1. Download both repositories

You can clone them with Git:

```bash
git clone https://github.com/disyheartfield/suncycle.git
git clone https://github.com/disyheartfield/suncycle-backend.git
```

Alternatively, clone both repositories using GitHub Desktop.

API-key files are deliberately excluded from GitHub, so cloning the repositories will not download anyone else's credentials.

### 2. Set up the backend

Open Terminal inside the `suncycle-backend` folder:

```bash
cd suncycle-backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install fastapi uvicorn requests shapely suncalc colorama python-dotenv
```

Create a new plain-text file inside `suncycle-backend` named exactly:

```text
.env
```

Add your GraphHopper key:

```text
GRAPHHOPPER_API_KEY=your_graphhopper_key_here
```

Do not add quotation marks. Save the file.

The `.env` file is listed in `.gitignore`. It should not appear in GitHub Desktop, and it should never be committed.

Start the backend:

```bash
python3 -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

Leave this Terminal window running. Wait until it says:

```text
Application startup complete.
```

In a second Terminal window, check that the backend is reachable:

```bash
curl http://127.0.0.1:8001/health
```

Expected response:

```json
{"status":"ok","service":"SunCycle API"}
```

### 3. Set up the frontend

Open another Terminal window inside the `suncycle` frontend folder:

```bash
cd suncycle
npm install
```

Create a new file inside the frontend's `src` folder named:

```text
config.js
```

Add your Mapbox and ShadeMap credentials:

```js
export const MAPBOX_TOKEN = "your_mapbox_public_token";
export const SHADEMAP_KEY = "your_shademap_api_key";
```

Save the file. `src/config.js` is listed in `.gitignore` and should never be committed.

### 4. Start the app

For the iOS Simulator, run:

```bash
npx expo run:ios
```

The first native build can take several minutes. For later JavaScript-only sessions, you can normally use:

```bash
npx expo start --clear
```

Then press `i` to open the iOS Simulator.

Keep the backend Terminal running while using the app.

### 5. Try a route

1. Enter two UK postcodes.
2. Leave departure set to **Now**, or choose a time today.
3. Press **Find Sunniest Route**.
4. Wait while SunCycle obtains and scores the route alternatives.

The first request may be slower while routing, building and shadow data load.

## Testing on a physical iPhone

The frontend uses this backend address by default:

```js
const BASE_URL = "http://127.0.0.1:8001";
```

This works in the iOS Simulator. On a physical iPhone, `127.0.0.1` means the iPhone itself rather than your Mac.

To test on a phone:

1. Connect the Mac and iPhone to the same Wi-Fi network.
2. Find the Mac's local Wi-Fi address:

   ```bash
   ipconfig getifaddr en0
   ```

3. Temporarily update `BASE_URL` in `src/api.js`, for example:

   ```js
   const BASE_URL = "http://192.168.1.123:8001";
   ```

4. Start the backend with `--host 0.0.0.0` as shown above.

Avoid committing a temporary private-network address unless it is an intentional project configuration.

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

- UK postcode lookup only.
- SunCycle compares GraphHopper's alternative routes; it does not search every possible street combination for a mathematically optimal sunny route.
- A selected time applies to today. There is not yet a separate date picker.
- Every route point is evaluated at the chosen departure time. The calculation does not yet advance the time as the cyclist travels.
- Building and terrain shadows are included, but tree-canopy shade is not currently modelled.
- The route centreline is tested rather than a particular side of the road or cycle lane.
- Follow mode displays position and phone direction but is not turn-by-turn navigation and does not reroute.
- The app requires an internet connection and access to its external services.

## Project structure

### Frontend

```text
src/
├── api.js                         # Communicates with the FastAPI backend
├── config.js                      # Local Mapbox and ShadeMap credentials
├── components/
│   └── ShadingWebView.js          # Performs ShadeMap calculations
└── screens/
    ├── HomeScreen.js              # Postcodes and departure time
    └── RoutesScreen.js            # Route ranking and coloured map
```

### Backend

```text
suncycle-backend/
├── server.py                      # FastAPI endpoints and configuration
├── routing.py                     # Postcode lookup and cycling routes
├── scoring.py                     # Route scoring
├── shadows.py                     # Building-shadow calculations
├── solar.py                       # Solar position calculations
└── .env                           # Local GraphHopper key; never committed
```

## Keeping API keys safe

Never commit:

```text
suncycle/src/config.js
suncycle-backend/.env
```

These files will not appear after cloning the repositories or moving to a new GitHub Desktop copy. This is intentional: create them locally in every new clone.

If a key has appeared in a public repository, screenshot or error message, revoke it in the provider's dashboard and create a replacement. Removing it from the latest version of a file does not remove it from Git history.

## Troubleshooting

### `GRAPHHOPPER_API_KEY is not configured`

Confirm that `.env`:

- is inside the backend folder beside `server.py`;
- is named exactly `.env`, not `.env.txt`;
- is saved as plain text; and
- contains an active GraphHopper key.

Check whether Python can load it without displaying the key:

```bash
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print('Key loaded:', bool(os.getenv('GRAPHHOPPER_API_KEY')))"
```

The expected result is:

```text
Key loaded: True
```

Restart Uvicorn after creating or changing `.env`.

### `401 Client Error: Unauthorized`

The GraphHopper key is invalid or has been revoked. Update `.env` with an active key and restart the backend.

### `curl` cannot connect to port 8001

The backend is not running. Start Uvicorn and wait for `Application startup complete` before opening the app.

### `externally-managed-environment`

The Python virtual environment is not active. Do not use `--break-system-packages`. Activate `.venv` and run the installation command again.

### The app works in Simulator but not on an iPhone

Use the Mac's local Wi-Fi address in `src/api.js`, start Uvicorn with `--host 0.0.0.0`, and keep both devices on the same Wi-Fi network.

### Native iOS warnings about haptics, keyboards or VectorKit

The iOS Simulator can print native framework warnings even when the app works correctly. Investigate them only if there is a visible symptom such as a crash, missing map, missing route or failed ShadeMap calculation.

## Technology

- React Native and Expo SDK 56
- Mapbox GL JS
- ShadeMap (`mapbox-gl-shadow-simulator`)
- GraphHopper Directions API
- FastAPI and Uvicorn
- postcodes.io
