/**
 * ShadingWebView.js — Original version that gave 86%/100%/79%
 * Uses _generateShadeProfile from mapbox-gl-shadow-simulator
 */

import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: W, height: H } = Dimensions.get('window');

import { MAPBOX_TOKEN, SHADEMAP_KEY } from '../config';


const makeHTML = (mapboxToken, shadeMapKey) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
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
  const BUILDING_ZOOM = 15;

  function postRN(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(e) {}
  }

  function mapIdle(map) {
    return new Promise(resolve => {
      if (map.loaded() && !map.isMoving()) resolve();
      else map.once('idle', resolve);
    });
  }

  function toPixel(lng, lat, zoom) {
    const n = Math.pow(2, zoom) * 256;
    const x = (lng + 180) / 360 * n;
    const latR = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
    return [x, y];
  }

  function splitGroups(points, vpW, vpH) {
    const groups = [];
    const remaining = [...points];
    const limit = 0.75;
    while (remaining.length > 0) {
      const group = [remaining.shift()];
      while (remaining.length > 0) {
        const candidate = [...group, remaining[0]];
        const lngs = candidate.map(p => p[0]);
        const lats = candidate.map(p => p[1]);
        const [minX] = toPixel(Math.min(...lngs), Math.max(...lats), BUILDING_ZOOM);
        const [maxX] = toPixel(Math.max(...lngs), Math.min(...lats), BUILDING_ZOOM);
        const [, minY] = toPixel(Math.min(...lngs), Math.max(...lats), BUILDING_ZOOM);
        const [, maxY] = toPixel(Math.max(...lngs), Math.min(...lats), BUILDING_ZOOM);
        if (Math.abs(maxX - minX) < vpW * limit && Math.abs(maxY - minY) < vpH * limit) {
          group.push(remaining.shift());
        } else { break; }
      }
      groups.push(group);
    }
    return groups;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    zoom: BUILDING_ZOOM,
    center: [-0.118, 51.509],
    interactive: false,
  });

  let shadeMap = null;
  let ready = false;
  let pending = null;

  map.on('load', () => {
    shadeMap = new ShadeMap({
      apiKey: SHADEMAP_KEY,
      date: new Date(),
      color: '#01112f',
      opacity: 0.0,
      terrainSource: {
        tileSize: 256,
        maxZoom: 15,
        getSourceUrl: ({ x, y, z }) =>
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + x + '/' + y + '.png',
        getElevation: ({ r, g, b }) => (r * 256 + g + b / 256) - 32768,
      },
      getFeatures: async () => {
        return map.querySourceFeatures('composite', { sourceLayer: 'building' })
          .filter(f => f.properties
            && f.properties.underground !== 'true'
            && (f.properties.height || f.properties.render_height));
      },
    }).addTo(map);

    ready = true;
    postRN({ type: 'ready' });
    if (pending) { processRequest(pending); pending = null; }
  });

  async function processRequest({ routes, datetime }) {
    const date = new Date();
    if (datetime) {
      const parts = String(datetime).trim().split(':');
      if (parts.length === 2) {
        date.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      }
    }
    shadeMap.setDate(date);

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const results = [];

    for (let ri = 0; ri < routes.length; ri++) {
      postRN({ type: 'progress', routeIndex: ri, total: routes.length });

      const route = routes[ri];
      const points = route.segments.flatMap(seg => seg.coordinates);

      if (points.length < 2) {
        results.push({ routeId: route.id, sunPercent: 50 });
        continue;
      }

      const groups = splitGroups(points, vpW, vpH);
      let totalPts = 0, sunPts = 0;

      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        const lngs = group.map(p => p[0]);
        const lats = group.map(p => p[1]);
        const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        const cy = (Math.min(...lats) + Math.max(...lats)) / 2;

        map.jumpTo({ center: [cx, cy], zoom: BUILDING_ZOOM });

        const shadeIdle = new Promise(res => shadeMap.once('idle', res));
        await mapIdle(map);
        await shadeIdle;

        const locations = group.map(([lng, lat]) => ({ lng, lat }));
        const bitmap = shadeMap._generateShadeProfile({
          locations,
          dates: [date],
          sunColor:   [255, 255, 255, 255],
          shadeColor: [0,   0,   0,   255],
        });

        for (let i = 0; i < bitmap.length / 4; i++) {
          totalPts++;
          if (bitmap[i * 4] === 255) sunPts++;
        }
      }

      const sunPercent = totalPts > 0 ? Math.round((sunPts / totalPts) * 1000) / 10 : 50;
      results.push({ routeId: route.id, sunPercent });
    }

    postRN({ type: 'scores', results });
  }

  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'score') {
        if (!ready) { pending = data; }
        else { processRequest(data); }
      }
    } catch (e) {
      postRN({ type: 'error', message: e.message });
    }
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
<\/script>
</body>
</html>
`;

export default function ShadingWebView({ routes, departureTime, onProgress, onScores, onError }) {
  const webviewRef = useRef(null);
  const hasScored = useRef(false);

  const scoreRoutes = useCallback(() => {
    if (!routes || hasScored.current) return;
    hasScored.current = true;
    const message = JSON.stringify({ type: 'score', routes, datetime: departureTime });
    setTimeout(() => { webviewRef.current?.postMessage(message); }, 500);
  }, [routes, departureTime]);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        scoreRoutes();
      } else if (data.type === 'progress') {
        onProgress?.(`Calculating shadows: route ${data.routeIndex + 1}/${data.total}`);
      } else if (data.type === 'scores') {
        // This version returns sunPercent directly (0-100)
        // Convert to buildingScore format for handleScores
        onScores?.(data.results.map(r => ({
          routeId: r.routeId,
          buildingScore: (r.sunPercent ?? 50) / 100,
        })));
      } else if (data.type === 'error') {
        onError?.(data.message);
      }
    } catch (e) {
      onError?.(e.message);
    }
  }, [scoreRoutes, onProgress, onScores, onError]);

  return (
    <View style={styles.offscreen}>
      <WebView
        ref={webviewRef}
        source={{ html: makeHTML(MAPBOX_TOKEN, SHADEMAP_KEY) }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        style={styles.webview}
        onError={(e) => onError?.(e.nativeEvent.description)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -H - 10,
    left: 0,
    width: W,
    height: H,
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
});