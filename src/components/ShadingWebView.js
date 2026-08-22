/**
 * ShadingWebView.js
 *
 * Runs ShadeMap in a WebView and makes it the authoritative source for both
 * route percentages and per-segment sun/shade classifications.
 */

import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

import { MAPBOX_TOKEN, SHADEMAP_KEY } from '../config';

const { width: W, height: H } = Dimensions.get('window');

// Pin the library so a future unpkg release cannot silently change scoring.
const SHADEMAP_VERSION = '0.68.2';

const makeHTML = (mapboxToken, shadeMapKey) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"><\/script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://unpkg.com/mapbox-gl-shadow-simulator@${SHADEMAP_VERSION}/dist/mapbox-gl-shadow-simulator.umd.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100vw; height:100vh; overflow:hidden; background:#000; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const MAPBOX_TOKEN = '${mapboxToken}';
  const SHADEMAP_KEY = '${shadeMapKey}';
  const BUILDING_ZOOM = 15;
  const RENDER_TIMEOUT_MS = 30000;

  function postRN(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch (e) {}
  }

  // ShadeMap's official example waits until Mapbox reports every visible
  // source loaded before querying the building layer.
  function mapLoaded(map) {
    return new Promise((resolve, reject) => {
      let timer = null;

      function cleanup() {
        map.off('render', check);
        if (timer) clearTimeout(timer);
      }

      function check() {
        if (!map.loaded()) return;
        cleanup();
        resolve();
      }

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('Mapbox tiles did not finish loading'));
      }, RENDER_TIMEOUT_MS);

      map.on('render', check);
      check();
    });
  }

  function waitForShadeIdle() {
    return new Promise((resolve, reject) => {
      let removeListener = null;
      const timer = setTimeout(() => {
        if (removeListener) removeListener();
        reject(new Error('ShadeMap did not finish rendering'));
      }, RENDER_TIMEOUT_MS);

      removeListener = shadeMap.once('idle', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  function waitForFrames(count) {
    return new Promise(resolve => {
      function next(remaining) {
        if (remaining <= 0) resolve();
        else requestAnimationFrame(() => next(remaining - 1));
      }
      next(count);
    });
  }

  function toPixel(lng, lat, zoom) {
    const n = Math.pow(2, zoom) * 512;
    const x = (lng + 180) / 360 * n;
    const latR = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
    return [x, y];
  }

  // Keep each group comfortably inside the viewport. isPositionInSun expects
  // screen pixels, so every tested coordinate must be visible when projected.
  function splitGroups(points, vpW, vpH) {
    const groups = [];
    const remaining = points.slice();
    const limit = 0.6;

    while (remaining.length > 0) {
      const group = [remaining.shift()];
      while (remaining.length > 0) {
        const candidate = group.concat([remaining[0]]);
        const worldPoints = candidate.map(point => toPixel(point[0], point[1], BUILDING_ZOOM));
        const xs = worldPoints.map(point => point[0]);
        const ys = worldPoints.map(point => point[1]);
        const fits = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) < vpW * limit
          && (Math.max.apply(null, ys) - Math.min.apply(null, ys)) < vpH * limit;
        if (!fits) break;
        group.push(remaining.shift());
      }
      groups.push(group);
    }

    return groups;
  }

  function flattenRoute(route) {
    const points = [];
    (route.segments || []).forEach(segment => {
      (segment.coordinates || []).forEach(coordinate => {
        if (!Array.isArray(coordinate) || coordinate.length < 2) return;
        const previous = points[points.length - 1];
        if (!previous || previous[0] !== coordinate[0] || previous[1] !== coordinate[1]) {
          points.push([coordinate[0], coordinate[1]]);
        }
      });
    });
    return points;
  }

  function buildSegments(points, pointStates) {
    if (points.length === 0) return [];

    const segments = [];
    let runStart = 0;
    let runState = pointStates[0];

    for (let i = 1; i < points.length; i++) {
      if (pointStates[i] === runState) continue;

      // Include the transition point in both runs so map polylines stay joined.
      segments.push({
        coordinates: points.slice(runStart, i + 1),
        in_sun: runState,
        sun_score: runState ? 1 : 0,
        colour: runState ? '#FFD246' : '#4A7FA5',
      });
      runStart = i;
      runState = pointStates[i];
    }

    segments.push({
      coordinates: points.slice(runStart),
      in_sun: runState,
      sun_score: runState ? 1 : 0,
      colour: runState ? '#FFD246' : '#4A7FA5',
    });

    return segments;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    zoom: BUILDING_ZOOM,
    center: [-0.118, 51.509],
    interactive: false,
    fadeDuration: 0,
  });

  let shadeMap = null;
  let ready = false;
  let pending = null;
  let scoring = false;

  map.on('load', () => {
    shadeMap = new ShadeMap({
      apiKey: SHADEMAP_KEY,
      date: new Date(),
      color: '#01112f',
      // isPositionInSun reads the rendered shade layer. It must not be fully
      // transparent even though the containing WebView is visually hidden.
      opacity: 0.7,
      terrainSource: {
        tileSize: 256,
        maxZoom: 15,
        getSourceUrl: ({ x, y, z }) =>
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + x + '/' + y + '.png',
        getElevation: ({ r, g, b }) => (r * 256 + g + b / 256) - 32768,
      },
      getFeatures: async () => {
        await mapLoaded(map);
        return map.querySourceFeatures('composite', { sourceLayer: 'building' })
          .filter(feature => feature.properties
            && feature.properties.underground !== 'true'
            && (feature.properties.height || feature.properties.render_height));
      },
    }).addTo(map);

    ready = true;
    postRN({ type: 'ready' });
    if (pending) {
      const request = pending;
      pending = null;
      processRequest(request);
    }
  });

  async function scoreVisibleGroup(group, departure) {
    const lngs = group.map(point => point[0]);
    const lats = group.map(point => point[1]);
    const centre = [
      (Math.min.apply(null, lngs) + Math.max.apply(null, lngs)) / 2,
      (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2,
    ];

    const shadeIdle = waitForShadeIdle();
    map.jumpTo({ center: centre, zoom: BUILDING_ZOOM });
    shadeMap.setDate(new Date(departure.getTime()));

    await mapLoaded(map);
    await shadeIdle;
    await waitForFrames(2);

    return Promise.all(group.map(([lng, lat]) => {
      const pixel = map.project([lng, lat]);
      if (pixel.x < 0 || pixel.y < 0 || pixel.x >= window.innerWidth || pixel.y >= window.innerHeight) {
        throw new Error('A route point was outside the ShadeMap viewport');
      }
      return shadeMap.isPositionInSun(pixel.x, pixel.y);
    }));
  }

  async function processRequest({ routes, departureAt }) {
    if (scoring) return;
    scoring = true;

    try {
      const departure = new Date(departureAt);
      if (Number.isNaN(departure.getTime())) {
        throw new Error('Invalid departure timestamp');
      }

      const results = [];
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
        postRN({ type: 'progress', routeIndex, total: routes.length });

        const route = routes[routeIndex];
        const points = flattenRoute(route);
        if (points.length < 2) {
          throw new Error('Route ' + route.id + ' does not contain enough geometry to score');
        }

        const groups = splitGroups(points, vpW, vpH);
        const pointStates = [];

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
          const groupStates = await scoreVisibleGroup(groups[groupIndex], departure);
          pointStates.push.apply(pointStates, groupStates.map(value => value === true));
        }

        const sunnyPoints = pointStates.filter(Boolean).length;
        const sunPercent = Math.round((sunnyPoints / pointStates.length) * 1000) / 10;
        results.push({
          routeId: route.id,
          sunPercent,
          segments: buildSegments(points, pointStates),
        });
      }

      postRN({ type: 'scores', results, departureAt: departure.toISOString() });
    } catch (error) {
      postRN({ type: 'error', message: error && error.message ? error.message : String(error) });
    } finally {
      scoring = false;
    }
  }

  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.type !== 'score') return;
      if (!ready) pending = data;
      else processRequest(data);
    } catch (error) {
      postRN({ type: 'error', message: error.message });
    }
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
<\/script>
</body>
</html>
`;

export default function ShadingWebView({ routes, departureAt, onProgress, onScores, onError }) {
  const webviewRef = useRef(null);
  const hasScored = useRef(false);

  const scoreRoutes = useCallback(() => {
    if (!routes?.length || !departureAt || hasScored.current) return;
    hasScored.current = true;
    const message = JSON.stringify({ type: 'score', routes, departureAt });
    setTimeout(() => webviewRef.current?.postMessage(message), 250);
  }, [routes, departureAt]);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        scoreRoutes();
      } else if (data.type === 'progress') {
        onProgress?.(`Calculating shadows: route ${data.routeIndex + 1}/${data.total}`);
      } else if (data.type === 'scores') {
        onScores?.(data.results);
      } else if (data.type === 'error') {
        onError?.(data.message);
      }
    } catch (error) {
      onError?.(error.message);
    }
  }, [scoreRoutes, onProgress, onScores, onError]);

  return (
    <View pointerEvents="none" style={styles.renderer}>
      <WebView
        ref={webviewRef}
        source={{ html: makeHTML(MAPBOX_TOKEN, SHADEMAP_KEY) }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        webviewDebuggingEnabled
        style={styles.webview}
        onError={(event) => onError?.(event.nativeEvent.description)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep the WebGL surface on-screen while the blocking loading modal is open.
  // Moving it outside the viewport can make iOS throttle the renderer.
  renderer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W,
    height: H,
    opacity: 0.01,
  },
  webview: { flex: 1, backgroundColor: '#000000' },
});