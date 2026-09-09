/**
 * ShadeMapDiagnostic.js
 *
 * Standalone diagnostic test for ShadeMap time-dependent shadow output.
 * Does NOT use the main app's routing, scoring, or backend.
 *
 * Tests isPositionInSun for a fixed set of coordinates at three explicit
 * timestamps. Logs the exact timestamp, coordinates, raw per-point results,
 * and resulting sun percentage for each test.
 *
 * USAGE: Temporarily replace ShadingWebView with this component in
 * RoutesScreen.js to run the test on app load:
 *
 *   import ShadeMapDiagnostic from '../components/ShadeMapDiagnostic';
 *   // In render:
 *   <ShadeMapDiagnostic />
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAPBOX_TOKEN, SHADEMAP_KEY } from '../config';

const { width: W, height: H } = Dimensions.get('window');

// ── Fixed test data ──────────────────────────────────────────────────────────

// Five coordinates along the N19 3DA → SE1 7PB corridor.
// These are hardcoded — no routing, no backend.
const TEST_COORDS = [
  { lat: 51.5650, lng: -0.1270, label: 'N19 area (Archway)' },
  { lat: 51.5530, lng: -0.1150, label: 'Holloway Road' },
  { lat: 51.5350, lng: -0.1060, label: 'Angel / Islington' },
  { lat: 51.5200, lng: -0.0950, label: 'City of London' },
  { lat: 51.5030, lng: -0.0890, label: 'SE1 area (Southwark)' },
];

// Three explicit timestamps. Constructed by setting hours on a fixed date.
// new Date() is used only as a base for .setFullYear/.setMonth/.setDate —
// the time component is always explicitly set, never left as "now".
function makeTimestamp(year, month, day, hour, minute) {
  const d = new Date(0); // epoch — definitely not "now"
  d.setFullYear(year);
  d.setMonth(month - 1); // JS months are 0-indexed
  d.setDate(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Using 15 Aug 2026 as a fixed summer date in London.
const TEST_TIMESTAMPS = [
  { label: 'Midnight',        date: makeTimestamp(2026, 8, 15, 0,  0) },
  { label: 'Morning (09:00)', date: makeTimestamp(2026, 8, 15, 9,  0) },
  { label: 'Midday (12:00)',  date: makeTimestamp(2026, 8, 15, 12, 0) },
];

// ── HTML ─────────────────────────────────────────────────────────────────────

const makeHTML = (mapboxToken, shadeMapKey, testCoords, testTimestamps) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"><\/script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://unpkg.com/mapbox-gl-shadow-simulator/dist/mapbox-gl-shadow-simulator.umd.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100vw; height:100vh; overflow:hidden; background:#000; }
    #map { width:100vw; height:100vh; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const MAPBOX_TOKEN = '${mapboxToken}';
  const SHADEMAP_KEY = '${shadeMapKey}';

  // Fixed test data serialised from React Native
  const TEST_COORDS = ${JSON.stringify(testCoords)};
  const TEST_TIMESTAMPS = ${JSON.stringify(
    testTimestamps.map(t => ({
      label: t.label,
      iso: t.date.toISOString(),
      ms: t.date.getTime(),
    }))
  )};

  function postRN(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(e) {}
  }
  function log(msg) {
    postRN({ type: 'log', msg });
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  // Centre the map on the midpoint of the test corridor
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    zoom: 13,
    center: [-0.107, 51.534], // midpoint of test coords
    interactive: false,
  });

  map.on('load', async () => {
    log('=== ShadeMap Diagnostic Test Starting ===');
    log('Test coordinates: ' + TEST_COORDS.length);
    log('Test timestamps: ' + TEST_TIMESTAMPS.map(t => t.label).join(', '));

    for (const ts of TEST_TIMESTAMPS) {
      await runTest(ts);
    }

    log('=== All tests complete ===');
    postRN({ type: 'done' });
  });

  async function runTest(ts) {
    const date = new Date(ts.ms); // reconstruct from ms — no new Date()

    log('');
    log('--- Test: ' + ts.label + ' ---');
    log('Timestamp passed to ShadeMap: ' + date.toISOString());

    // Create a fresh ShadeMap instance for each timestamp.
    // This avoids any setDate() re-render timing issue entirely —
    // the correct time is baked in at construction.
    const shadeMap = new ShadeMap({
      apiKey: SHADEMAP_KEY,
      date: date,
      color: '#01112f',
      opacity: 0.7,
      getFeatures: async () => {
        const buildings = map.querySourceFeatures('composite', { sourceLayer: 'building' })
          .filter(f => f.properties
            && f.properties.underground !== 'true'
            && (f.properties.height || f.properties.render_height));
        log('Buildings loaded for this viewport: ' + buildings.length);
        return buildings;
      },
    }).addTo(map);

    // Wait for ShadeMap to finish its initial render at this timestamp.
    // This is a single wait — no setDate() is called, so there is no
    // re-render timing gap. The shadow texture is computed once at
    // construction time.
    await new Promise(resolve => shadeMap.once('idle', resolve));
    log('ShadeMap idle — shadow render complete for: ' + date.toISOString());

    // Test each coordinate.
    // Pan the map to each coordinate first so the building tiles are loaded
    // and the coordinate is within the viewport (required for map.project).
    let sunCount = 0;
    const results = [];

    for (const coord of TEST_COORDS) {
      // Pan to this coordinate
      map.jumpTo({ center: [coord.lng, coord.lat], zoom: 15 });

      // Wait for map tiles and ShadeMap to render for this viewport
      await new Promise(resolve => {
        shadeMap.once('idle', resolve);
      });

      // Convert lat/lng to screen pixel and read shadow state
      const { x, y } = map.project([coord.lng, coord.lat]);
      const inSun = await shadeMap.isPositionInSun(x, y);

      if (inSun) sunCount++;
      results.push({ label: coord.label, x: Math.round(x), y: Math.round(y), inSun });

      log('  ' + coord.label + ': pixel=(' + Math.round(x) + ',' + Math.round(y) + ') inSun=' + inSun);
    }

    const sunPercent = Math.round((sunCount / TEST_COORDS.length) * 100);
    log('Result for ' + ts.label + ': ' + sunCount + '/' + TEST_COORDS.length + ' in sun = ' + sunPercent + '%');

    // Clean up — remove this ShadeMap instance before the next test
    shadeMap.remove();
    log('ShadeMap instance removed');
  }
<\/script>
</body>
</html>
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShadeMapDiagnostic() {
  const webviewRef = useRef(null);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'log') {
        console.log('[DIAGNOSTIC]', data.msg);
      } else if (data.type === 'done') {
        console.log('[DIAGNOSTIC] All tests finished — check logs above');
      }
    } catch (e) {
      console.log('[DIAGNOSTIC ERROR]', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html: makeHTML(
          MAPBOX_TOKEN,
          SHADEMAP_KEY,
          TEST_COORDS,
          TEST_TIMESTAMPS
        )}}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        webviewDebuggingEnabled={true}
        style={styles.webview}
        onError={(e) => console.log('[DIAGNOSTIC WEBVIEW ERROR]', e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -H - 10,
    left: 0,
    width: W,
    height: H,
  },
  webview: { flex: 1, backgroundColor: '#000000' },
});
