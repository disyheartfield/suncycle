/**
 * RoutesScreen.js — Route results with progressive ShadeMap shadow scoring
 *
 * FLOW:
 * 1. Backend returns routes immediately with orientation-based scores (~5s)
 * 2. Results show right away with a "Refining with building shadows..." banner
 * 3. ShadingWebView calculates real shadows in the background
 * 4. Scores update when ShadeMap finishes — routes may re-rank
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { colours, radius, spacing, sunScoreColour } from '../theme';
import RouteCard from '../components/RouteCard';
import SunScore from '../components/SunScore';
import ShadingWebView from '../components/ShadingWebView';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_FULL = SCREEN_HEIGHT * 0.52;
const SHEET_MINI = 90;
const MAP_FULL = SCREEN_HEIGHT - SHEET_MINI - 50;
const MAP_HALF = SCREEN_HEIGHT * 0.45;

export default function RoutesScreen({ route: navRoute, navigation }) {
  const { data, start, end } = navRoute.params;
  const { sun_position, departure_time, start_coords, end_coords } = data;

  const [routes, setRoutes] = useState(data.routes);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [shadingStatus, setShadingStatus] = useState('refining');
  const [shadingMessage, setShadingMessage] = useState('Calculating building shadows…');

  const mapRef = useRef(null);
  const sheetAnim = useRef(new Animated.Value(SHEET_FULL)).current;
  const mapAnim = useRef(new Animated.Value(MAP_HALF)).current;
  const sheetEntrance = useRef(new Animated.Value(300)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(1)).current;

  const selected = routes[selectedIdx];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sheetEntrance, { toValue: 0, tension: 60, friction: 12, delay: 300, useNativeDriver: false}),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 400, delay: 300, useNativeDriver: false  }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !selected?.segments?.length) return;
    const allCoords = selected.segments.flatMap(s =>
      s.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    );
    if (allCoords.length) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(allCoords, {
          edgePadding: { top: 60, right: 40, bottom: sheetExpanded ? 60 : 20, left: 40 },
          animated: true,
        });
      }, 100);
    }
  }, [selectedIdx, sheetExpanded]);

  const toggleSheet = () => {
    const expanding = !sheetExpanded;
    setSheetExpanded(expanding);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: expanding ? SHEET_FULL : SHEET_MINI, tension: 65, friction: 12, useNativeDriver: false }),
      Animated.spring(mapAnim, { toValue: expanding ? MAP_HALF : MAP_FULL, tension: 65, friction: 12, useNativeDriver: false }),
    ]).start();
  };
  const handleProgress = useCallback((msg) => {
    setShadingMessage(msg);
  }, []);
  
  const handleScores = useCallback((results) => {
    setRoutes(prev => {
      const updated = prev.map(route => {
        const match = results.find(r => r.routeId === route.id);
        if (!match) return route;
  
        // buildingScore is 0-1 from isPositionInSun
        // orientationScore is 0-100 from backend, convert to 0-1
        const orientationScore = (route.sun_percent || 0) / 100;
        const buildingScore = typeof match.buildingScore === 'number'
          ? match.buildingScore : 0.5;
        const intensity = Math.max(0, sun_position.intensity || 0);
  
        const combinedRaw = orientationScore * 0.65 + buildingScore * 0.35;
        const finalPercent = Math.round(combinedRaw * intensity * 1000) / 10;
  
        return {
          ...route,
          sun_percent: finalPercent,
          sunny_km: Math.round(route.distance_km * finalPercent / 100 * 10) / 10,
          description: describeRoute(finalPercent, sun_position.altitude, departure_time),
        };
      });
  
      const sunniest = updated.reduce((a, b) => a.sun_percent > b.sun_percent ? a : b);
      const fastest  = updated.reduce((a, b) => a.duration_min < b.duration_min ? a : b);
      return updated.map(r => ({
        ...r,
        is_sunniest: r.id === sunniest.id,
        is_fastest:  r.id === fastest.id,
      }));
    });
    setShadingStatus('done');
    Animated.timing(bannerOpacity, { toValue: 0, duration: 800, delay: 2000, useNativeDriver: true }).start();
  }, [sun_position, departure_time]);

  const handleShadingError = useCallback((msg) => {
    console.warn('ShadeMap error:', msg);
    setShadingStatus('error');
    setShadingMessage('Shadow data unavailable — showing sun angle estimate');
    Animated.timing(bannerOpacity, { toValue: 0, duration: 800, delay: 3000, useNativeDriver: true }).start();
  }, []);

  const scoreColour = sunScoreColour(selected?.sun_percent ?? 0);

  return (
    <View style={styles.container}>
      <ShadingWebView
  routes={routes}
  departureTime={departure_time}
  sunIntensity={sun_position.intensity}
  onProgress={handleProgress}
  onScores={handleScores}
  onError={handleShadingError}
    />

      <Animated.View style={[styles.mapContainer, { height: mapAnim }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType="mutedStandard"
          userInterfaceStyle="dark"
          initialRegion={{
            latitude: (start_coords[0] + end_coords[0]) / 2,
            longitude: (start_coords[1] + end_coords[1]) / 2,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          showsCompass={false}
          showsScale={false}
        >
          {routes.map((r, rIdx) =>
            r.segments?.map((seg, sIdx) => (
              <Polyline
                key={`${rIdx}-${sIdx}`}
                coordinates={seg.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                strokeColor={
                  rIdx === selectedIdx
                    ? seg.in_sun ? colours.sun : colours.shade
                    : colours.textTertiary + '30'
                }
                strokeWidth={rIdx === selectedIdx ? 5 : 2}
                lineCap="round"
                lineJoin="round"
              />
            ))
          )}
          <Marker coordinate={{ latitude: start_coords[0], longitude: start_coords[1] }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerStart}><View style={styles.markerDot} /></View>
          </Marker>
          <Marker coordinate={{ latitude: end_coords[0], longitude: end_coords[1] }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerEnd}><Text style={styles.markerEndIcon}>★</Text></View>
          </Marker>
        </MapView>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.sunPill}>
          <Text style={styles.sunPillText}>☀ {sun_position.compass} · {sun_position.altitude}° · {departure_time}</Text>
        </View>

        {shadingStatus !== 'done' && (
          <Animated.View style={[styles.shadingBanner, { opacity: bannerOpacity }]}>
            <Text style={styles.shadingDot}>●</Text>
            <Text style={styles.shadingText}>{shadingMessage}</Text>
          </Animated.View>
        )}

        {!sheetExpanded && selected && (
          <TouchableOpacity style={styles.floatingCard} onPress={toggleSheet}>
            <View style={styles.floatingCardInner}>
              <Text style={[styles.floatingScore, { color: scoreColour }]}>{Math.round(selected.sun_percent)}%</Text>
              <View style={styles.floatingMeta}>
                <Text style={styles.floatingDesc}>{selected.description}</Text>
                <Text style={styles.floatingStats}>{selected.duration_min} min · {selected.distance_km} km</Text>
              </View>
              <Text style={styles.floatingChevron}>▲</Text>
            </View>
          </TouchableOpacity>
        )}
      </Animated.View>

      <Animated.View style={[
        styles.sheet,
        { height: sheetAnim, transform: [{ translateY: sheetEntrance }], opacity: sheetOpacity }
      ]}>
        <TouchableOpacity style={styles.handleArea} onPress={toggleSheet}>
          <View style={styles.handle} />
          <Text style={styles.handleHint}>{sheetExpanded ? '▼  full screen map' : '▲  show routes'}</Text>
        </TouchableOpacity>

        {sheetExpanded && (
          <>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.routeFrom}>{start} → {end}</Text>
                <Text style={styles.routeSub}>{routes.length} routes · sunniest first</Text>
              </View>
              {selected && <SunScore percent={selected.sun_percent} size="small" animated={false} />}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardList}>
              {routes.map((r, i) => (
                <RouteCard key={r.id} route={r} selected={i === selectedIdx} onPress={() => setSelectedIdx(i)} delay={i * 80} />
              ))}
              <Text style={styles.disclaimer}>
                {shadingStatus === 'done' ? '✓ Building shadow data from ShadeMap + OSM' : 'Shadow data loading… scores may update'}
              </Text>
            </ScrollView>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function describeRoute(sunPct, altitude, departureTime) {
  const h = departureTime
    ? parseInt(departureTime.split(':')[0])
    : new Date().getHours();
  const tod = h < 6 ? 'night'
    : h < 12 ? 'morning'
    : h < 14 ? 'midday'
    : h < 18 ? 'afternoon'
    : h < 21 ? 'evening'
    : 'night';

  if (sunPct >= 75) {
    const opts = ['Golden ' + tod + ' ride', 'Sun on your face the whole way', 'Bright open route'];
    return opts[Math.floor(sunPct) % opts.length];
  }
  if (sunPct >= 55) {
    return 'Mostly sunny ' + tod;
  }
  if (sunPct >= 35) {
    return 'Mix of sun and shade';
  }
  if (sunPct >= 10) {
    return 'Mostly shaded — cooler ride';
  }
  return tod === 'night' ? 'Night ride — no direct sun' : 'Shaded route';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.bg },
  mapContainer: { width: '100%', position: 'relative' },
  backBtn: {
    position: 'absolute', top: 52, left: 16, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(15,14,12,0.88)', borderWidth: 1, borderColor: colours.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: colours.textPrimary, fontSize: 18, fontWeight: '600' },
  sunPill: {
    position: 'absolute', top: 52, alignSelf: 'center', left: SCREEN_WIDTH / 2 - 100,
    backgroundColor: 'rgba(15,14,12,0.88)', borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colours.borderGlow,
  },
  sunPillText: { color: colours.sun, fontSize: 12, fontWeight: '500' },
  shadingBanner: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: 'rgba(26,25,22,0.92)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,210,70,0.2)',
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  shadingDot: { color: colours.sun, fontSize: 8 },
  shadingText: { color: colours.textSecondary, fontSize: 12, flex: 1 },
  floatingCard: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: 'rgba(26,25,22,0.95)', borderRadius: radius.lg,
    borderWidth: 1, borderColor: colours.border, padding: spacing.md,
  },
  floatingCardInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  floatingScore: { fontFamily: 'Georgia', fontSize: 24, fontWeight: '700' },
  floatingMeta: { flex: 1 },
  floatingDesc: { color: colours.textPrimary, fontSize: 14, fontWeight: '500' },
  floatingStats: { color: colours.textSecondary, fontSize: 12, marginTop: 2 },
  floatingChevron: { color: colours.textTertiary, fontSize: 12 },
  sheet: {
    backgroundColor: colours.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colours.border, overflow: 'hidden', paddingHorizontal: spacing.lg,
  },
  handleArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  handle: { width: 36, height: 4, backgroundColor: colours.border, borderRadius: 2, marginBottom: 4 },
  handleHint: { color: colours.textTertiary, fontSize: 11, letterSpacing: 0.3 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, marginTop: spacing.xs,
  },
  routeFrom: { color: colours.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  routeSub: { color: colours.textSecondary, fontSize: 12, marginTop: 2 },
  cardList: { paddingBottom: spacing.xxl },
  disclaimer: { color: colours.textTertiary, fontSize: 11, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  markerStart: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: colours.bg,
    borderWidth: 2.5, borderColor: colours.sun, alignItems: 'center', justifyContent: 'center',
  },
  markerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colours.sun },
  markerEnd: { backgroundColor: colours.sun, borderRadius: radius.sm, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  markerEndIcon: { fontSize: 14, color: colours.bg },
});
