/**
 * RoutesScreen.js
 *
 * Displays scored cycling routes on a map, lets the user choose one,
 * and provides a privacy-conscious "Follow route" mode that shows their
 * position and phone direction on the selected route.
 *
 * Follow route is NOT turn-by-turn navigation:
 *  - No spoken directions.
 *  - No automatic re-routing.
 *  - No route-deviation alerts.
 *  - No journey history or stored coordinates.
 *  - Location is only active while the feature is in use.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Linking,
  Platform, Modal,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { colours, radius, spacing, sunScoreColour } from '../theme';
import RouteCard from '../components/RouteCard';
import SunScore from '../components/SunScore';
import ShadingWebView from '../components/ShadingWebView';
import { useFollowRoute } from '../hooks/useFollowRoute';
import LoadingScreen from '../components/LoadingScreen';


const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const SHEET_FULL = SCREEN_H * 0.52;
const SHEET_MINI = 88;

function describeRoute(sunPercent, departureAt) {
  const departure = new Date(departureAt);
  const hour = Number.isNaN(departure.getTime()) ? 12 : departure.getHours();
  const timeOfDay = hour < 6 ? 'night'
    : hour < 12 ? 'morning'
    : hour < 17 ? 'afternoon'
    : hour < 21 ? 'evening'
    : 'night';

  if (sunPercent >= 80) return `Very sunny ${timeOfDay} route`;
  if (sunPercent >= 60) return `Mostly sunny ${timeOfDay} route`;
  if (sunPercent >= 40) return 'Mix of sun and shade';
  if (sunPercent > 0) return 'Mostly shaded route';
  return timeOfDay === 'night' ? 'Night ride — no direct sun' : 'Fully shaded route';
}

function gradeRoute(sunPercent) {
  if (sunPercent >= 75) return '☀  Excellent';
  if (sunPercent >= 55) return '⛅ Good';
  if (sunPercent >= 35) return '🌤 Moderate';
  return '☁  Mostly shaded';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoutesScreen({ route: navRoute, navigation }) {
  const { data, start, end } = navRoute.params;
  const {
    routes: initialRoutes,
    sun_position,
    departure_time,
    departure_at,
    start_coords,
    end_coords,
  } = data;

  // ── Route selection state ───────────────────────────────────────────────────

  const [routes, setRoutes]           = useState(initialRoutes);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // ── ShadeMap shadow-scoring state ───────────────────────────────────────────

  const [shadingStatus,  setShadingStatus]  = useState('idle');   // idle | loading | done | error
  const [shadingMessage, setShadingMessage] = useState('');

  // ── Follow-route state (from hook) ─────────────────────────────────────────

  const {
    followState,
    userLocation,
    setUserLocation,
    userHeading,
    requestFollow,
    startAfterRationale,
    endFollowing,
    dismissDenied,
    dismissServicesDisabled,
  } = useFollowRoute();

  const isFollowing = followState === 'following';

  // Prevent accidental route changes once following has started
  const handleSelectRoute = (idx) => {
    if (!isFollowing) setSelectedIdx(idx);
  };

  // ── Refs & animations ───────────────────────────────────────────────────────

  const mapRef       = useRef(null);
  const sheetAnim    = useRef(new Animated.Value(SHEET_FULL)).current;
  const mapAnim      = useRef(new Animated.Value(SCREEN_H * 0.45)).current;
  const entranceY    = useRef(new Animated.Value(300)).current;
  const entranceOp   = useRef(new Animated.Value(0)).current;
  const hasCentred   = useRef(false);  // set when we auto-frame on follow start

  // ── Entrance animation ──────────────────────────────────────────────────────

  useEffect(() => {
    Animated.parallel([
      Animated.spring(entranceY,  { toValue: 0, tension: 60, friction: 12, delay: 300, useNativeDriver: false }),
      Animated.timing(entranceOp, { toValue: 1, duration: 400, delay: 300, useNativeDriver: false }),
    ]).start();
  }, []);

  // ── Fit map to selected route ───────────────────────────────────────────────

  const selected = routes[selectedIdx];

  useEffect(() => {
    if (!mapRef.current || !selected?.segments?.length || isFollowing) return;
    const coords = selected.segments.flatMap(seg =>
      seg.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    );
    if (coords.length) {
      setTimeout(() => mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: sheetExpanded ? 60 : 20, left: 40 },
        animated: true,
      }), 100);
    }
  }, [selected?.id, sheetExpanded, isFollowing]);

  // ── Auto-frame on follow start ──────────────────────────────────────────────

  useEffect(() => {
    if (!isFollowing || !userLocation || hasCentred.current) return;
    if (!selected?.segments?.length) return;

    hasCentred.current = true;

    const routeCoords = selected.segments.flatMap(seg =>
      seg.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    );
    const allCoords = [
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      ...routeCoords,
    ];
    mapRef.current?.fitToCoordinates(allCoords, {
      edgePadding: { top: 80, right: 40, bottom: 140, left: 40 },
      animated: true,
    });
  }, [isFollowing, userLocation]);

  // Reset the "has centred" flag when leaving follow mode
  useEffect(() => {
    if (!isFollowing) hasCentred.current = false;
  }, [isFollowing]);

  // ── Bottom sheet toggle ─────────────────────────────────────────────────────

  const toggleSheet = () => {
    const expanding = !sheetExpanded;
    setSheetExpanded(expanding);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: expanding ? SHEET_FULL : SHEET_MINI, tension: 65, friction: 12, useNativeDriver: false }),
      Animated.spring(mapAnim,   { toValue: expanding ? SCREEN_H * 0.45 : SCREEN_H - SHEET_MINI - 50, tension: 65, friction: 12, useNativeDriver: false }),
    ]).start();
  };

  // ── "Centre on me" ──────────────────────────────────────────────────────────

  const centreOnUser = useCallback(() => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({
      latitude:      userLocation.latitude,
      longitude:     userLocation.longitude,
      latitudeDelta:  0.005,
      longitudeDelta: 0.005,
    }, 500);
  }, [userLocation]);

  // ── ShadeMap callbacks ──────────────────────────────────────────────────────

  const handleProgress = useCallback((msg) => {
    setShadingStatus('loading');
    setShadingMessage(msg);
    const match = msg.match(/(\d+)\/(\d+)/);
    if (match) {
      setLoadingProgress((parseInt(match[1]) - 1) / parseInt(match[2]));
    }
  }, []);

  const handleScores = useCallback((results) => {
    setRoutes(prev => {
      const updated = prev.map(route => {
        const match = results.find(r => r.routeId === route.id);
        if (!match) return route;
        const finalPercent = Math.round((match.sunPercent ?? 0) * 10) / 10;
        return {
          ...route,
          sun_percent: finalPercent,
          sunny_km:    Math.round(route.distance_km * finalPercent / 100 * 10) / 10,
          segments:     match.segments,
          score:        finalPercent,
          grade:        gradeRoute(finalPercent),
          description:  describeRoute(finalPercent, departure_at),
        };
      });

      const sunniest = updated.reduce((a, b) => a.sun_percent > b.sun_percent ? a : b);
      const fastest  = updated.reduce((a, b) => a.duration_min < b.duration_min ? a : b);
      return updated
        .map(r => ({
          ...r,
          is_sunniest: r.id === sunniest.id,
          is_fastest:  r.id === fastest.id,
        }))
        .sort((a, b) => b.sun_percent - a.sun_percent || a.duration_min - b.duration_min);
    });

    setShadingStatus('done')
    setIsReady(true); 
  }, [departure_at]);

  const handleShadingError = useCallback((err) => {
    setShadingStatus('error');
    setShadingMessage(String(err));
    setIsReady(true) ; 
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const scoreColour = sunScoreColour(selected?.sun_percent ?? 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
  

      {/* ── Map ── */}
      <Animated.View style={[styles.mapWrap, { height: mapAnim }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType="mutedStandard"
          userInterfaceStyle="dark"
          showsUserLocation={isFollowing}
          followsUserLocation={false}
          onUserLocationChange={(e)=>{
            if (isFollowing){
              setUserLocation(e.nativeEvent.coordinate);
            }
          }}
          showsCompass={false}
          showsScale={false}
          initialRegion={{
            latitude:       (start_coords[0] + end_coords[0]) / 2,
            longitude:      (start_coords[1] + end_coords[1]) / 2,
            latitudeDelta:  0.08,
            longitudeDelta: 0.08,
          }}
        >
          {/* Route polylines — all routes, selected highlighted */}
          {routes.map((route, rIdx) =>
            route.segments?.map((seg, sIdx) => (
              <Polyline
                key={`${rIdx}-${sIdx}`}
                coordinates={seg.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                strokeColor={rIdx === selectedIdx
                  ? (seg.in_sun ? colours.sun : colours.shade)
                  : colours.textTertiary + '28'}
                strokeWidth={rIdx === selectedIdx ? 5 : 2}
                lineCap="round"
                lineJoin="round"
              />
            ))
          )}

          {/* Start marker */}
          <Marker
            coordinate={{ latitude: start_coords[0], longitude: start_coords[1] }}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={`Start: ${start}`}
          >
            <View style={styles.markerStart}>
              <View style={styles.markerDot} />
            </View>
          </Marker>

          {/* End marker */}
          <Marker
            coordinate={{ latitude: end_coords[0], longitude: end_coords[1] }}
            anchor={{ x: 0.5, y: 1 }}
            accessibilityLabel={`Destination: ${end}`}
          >
            <View style={styles.markerEnd}>
              <Text style={styles.markerEndIcon}>★</Text>
            </View>
          </Marker>
        </MapView>

        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { endFollowing(); navigation.goBack(); }}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        {/* Sun-position pill */}
        {!isFollowing && (
          <View style={styles.sunPill} accessibilityElementsHidden>
            <Text style={styles.sunPillText}>
              ☀ {sun_position.compass} · {sun_position.altitude}° · {departure_time}
            </Text>
          </View>
        )}

        {/* Following: compact info banner */}
        {isFollowing && (
          <View style={styles.followingBanner} accessibilityLiveRegion="polite">
            <Text style={styles.followingBannerTitle}>Following sunny route</Text>
            <Text style={styles.followingBannerSub}>
              Shows your position and phone direction · No turn directions
            </Text>
          </View>
        )}

        {/* Shading progress banner (idle / loading state) */}
        {!isFollowing && (shadingStatus === 'loading' || shadingStatus === 'error') && (
          <View style={styles.shadingBanner}>
            <Text style={styles.shadingBannerText}>
              {shadingStatus === 'error' ? `ShadeMap error: ${shadingMessage}` : shadingMessage}
            </Text>
          </View>
        )}

        {/* Following: "Centre on me" FAB */}
        {isFollowing && userLocation && (
          <TouchableOpacity
            style={styles.centreFAB}
            onPress={centreOnUser}
            accessibilityLabel="Centre map on my location"
            accessibilityRole="button"
          >
            <Text style={styles.centreFABIcon}>⦿</Text>
          </TouchableOpacity>
        )}

        {/* Mini card when sheet is collapsed (non-following) */}
        {!isFollowing && !sheetExpanded && selected && (
          <TouchableOpacity style={styles.miniCard} onPress={toggleSheet}>
            <View style={styles.miniCardInner}>
              <Text style={[styles.miniScore, { color: scoreColour }]}>
                {Math.round(selected.sun_percent)}%
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniDesc}>{selected.description}</Text>
                <Text style={styles.miniStats}>{selected.duration_min} min · {selected.distance_km} km</Text>
              </View>
              <Text style={styles.miniChevron}>▲</Text>
            </View>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Bottom sheet ── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height:    isFollowing ? SHEET_MINI : sheetAnim,
            transform: [{ translateY: entranceY }],
            opacity:   entranceOp,
          },
        ]}
      >
        {/* Sheet handle — hidden while following */}
        {!isFollowing && (
          <TouchableOpacity
            style={styles.handleArea}
            onPress={toggleSheet}
            accessibilityLabel={sheetExpanded ? 'Show full-screen map' : 'Show route options'}
            accessibilityRole="button"
          >
            <View style={styles.handle} />
            <Text style={styles.handleHint}>
              {sheetExpanded ? '▼  full screen map' : '▲  show routes'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Active following bar ── */}
        {isFollowing && (
          <View style={styles.followingBar}>
            <View style={styles.followingBarInfo}>
              {selected && (
                <>
                  <Text style={styles.followingBarStat}>{selected.duration_min} min</Text>
                  <Text style={styles.followingBarDot}>·</Text>
                  <Text style={styles.followingBarStat}>{selected.distance_km} km</Text>
                  <Text style={styles.followingBarDot}>·</Text>
                  <Text style={[styles.followingBarSun, { color: scoreColour }]}>
                    {Math.round(selected.sun_percent)}% ☀
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity
              style={styles.endBtn}
              onPress={endFollowing}
              accessibilityLabel="End route following"
              accessibilityRole="button"
            >
              <Text style={styles.endBtnLabel}>End</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Route cards (idle / expanded) ── */}
        {!isFollowing && sheetExpanded && (
          <>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.routeFrom}>{start} → {end}</Text>
                <Text style={styles.routeSub}>{routes.length} routes · sunniest first</Text>
              </View>
              {selected && (
                <SunScore percent={selected.sun_percent} size="small" animated={false} />
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cardList}
            >


                {routes.map((route, i) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    selected={i === selectedIdx}
                    onPress={() => handleSelectRoute(i)}
                    onFollow={requestFollow}
                    delay={i * 80}
                  />
              ))}
            

              
            </ScrollView>
          </>
        )}
      </Animated.View>

      {/* ── Hidden ShadeMap WebView (shadow scoring) ── */}
      {routes && shadingStatus !== 'done' && shadingStatus !== 'error' && (
        <ShadingWebView
          routes={routes}
          departureAt={departure_at}
          onProgress={handleProgress}
          onScores={handleScores}
          onError={handleShadingError}
        />
      )}

      {/* ── Permission rationale modal ── */}
      <Modal
        visible={followState === 'requesting_rationale'}
        transparent
        animationType="slide"
        onRequestClose={dismissDenied}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Location access</Text>
            <Text style={styles.modalBody}>
              Your location is used to show where you are in relation to your
              selected sunny route. It is not used for background tracking or
              journey history.
            </Text>
            <Text style={styles.modalBody}>
              The direction indicator shows where your phone is pointing. It is
              not a route instruction and may be affected by compass accuracy.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={dismissDenied}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={startAfterRationale}
                accessibilityLabel="Allow location while using the app"
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmLabel}>Allow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Permission denied modal ── */}
      <Modal
        visible={followState === 'denied'}
        transparent
        animationType="slide"
        onRequestClose={dismissDenied}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Location not available</Text>
            <Text style={styles.modalBody}>
              To see your position on the route, allow SunCycle to access your
              location while using the app. You can still view and compare
              routes without location access.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={dismissDenied}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelLabel}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  dismissDenied();
                  Linking.openSettings().catch(() => {});
                }}
                accessibilityLabel="Open Settings to change location permission"
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmLabel}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Location Services disabled modal ── */}
      <Modal
        visible={followState === 'services_disabled'}
        transparent
        animationType="slide"
        onRequestClose={dismissServicesDisabled}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Location Services are off</Text>
            <Text style={styles.modalBody}>
              Enable Location Services in Settings › Privacy & Security to
              use this feature. You can still view your routes without it.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={dismissServicesDisabled}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelLabel}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  dismissServicesDisabled();
                  Linking.openSettings().catch(() => {});
                }}
                accessibilityLabel="Open Settings"
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmLabel}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!isReady} transparent statusBarTranslucent>
        <LoadingScreen
          progress={loadingProgress}
          message={shadingMessage}
        />
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.bg, position: 'relative' },

  // ── Map ──
  mapWrap: { width: '100%', position: 'relative' },

  backBtn: {
    position: 'absolute', top: 52, left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(15,14,12,0.90)',
    borderWidth: 1, borderColor: colours.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: colours.textPrimary, fontSize: 18, fontWeight: '600' },

  sunPill: {
    position: 'absolute', top: 52,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,14,12,0.90)',
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: colours.borderGlow,
  },
  sunPillText: { color: colours.sun, fontSize: 12, fontWeight: '500' },

  followingBanner: {
    position: 'absolute', top: 52,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,14,12,0.92)',
    borderRadius: radius.lg,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: colours.border,
    maxWidth: SCREEN_W - 80,
    alignItems: 'center',
  },
  followingBannerTitle: {
    color: colours.textPrimary, fontSize: 13,
    fontWeight: '600', letterSpacing: -0.2,
  },
  followingBannerSub: {
    color: colours.textSecondary, fontSize: 11,
    marginTop: 2, textAlign: 'center',
  },

  shadingBanner: {
    position: 'absolute', top: 52,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,14,12,0.90)',
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: colours.border,
  },
  shadingBannerText: { color: colours.textSecondary, fontSize: 12 },

  centreFAB: {
    position: 'absolute', bottom: 20, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(26,25,22,0.95)',
    borderWidth: 1, borderColor: colours.border,
    alignItems: 'center', justifyContent: 'center',
  },
  centreFABIcon: { color: colours.textPrimary, fontSize: 22 },

  miniCard: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: 'rgba(26,25,22,0.95)',
    borderRadius: radius.lg, borderWidth: 1, borderColor: colours.border,
    padding: spacing.md,
  },
  miniCardInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  miniScore:     { fontFamily: 'Georgia', fontSize: 24, fontWeight: '700' },
  miniDesc:      { color: colours.textPrimary, fontSize: 14, fontWeight: '500' },
  miniStats:     { color: colours.textSecondary, fontSize: 12, marginTop: 2 },
  miniChevron:   { color: colours.textTertiary, fontSize: 12 },

  // ── Map markers ──
  markerStart: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colours.bg,
    borderWidth: 2.5, borderColor: colours.sun,
    alignItems: 'center', justifyContent: 'center',
  },
  markerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colours.sun },
  markerEnd: {
    backgroundColor: colours.sun, borderRadius: radius.sm,
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  markerEndIcon: { fontSize: 14, color: colours.bg },

  // ── Bottom sheet ──
  sheet: {
    backgroundColor: colours.bg,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colours.border,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
  },

  handleArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  handle:     { width: 36, height: 4, backgroundColor: colours.border, borderRadius: 2, marginBottom: 4 },
  handleHint: { color: colours.textTertiary, fontSize: 11, letterSpacing: 0.3 },

  // ── Following bar ──
  followingBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    flex: 1,
  },
  followingBarInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  followingBarStat: { color: colours.textPrimary, fontSize: 14, fontWeight: '500' },
  followingBarDot:  { color: colours.textTertiary, fontSize: 14 },
  followingBarSun:  { fontSize: 14, fontWeight: '600' },
  endBtn: {
    backgroundColor: colours.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colours.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    marginLeft: spacing.md,
  },
  endBtnLabel: { color: colours.textPrimary, fontSize: 15, fontWeight: '600' },

  // ── Sheet header ──
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, marginTop: spacing.xs,
  },
  routeFrom: { color: colours.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  routeSub:  { color: colours.textSecondary, fontSize: 12, marginTop: 2 },
  cardList:  { paddingBottom: spacing.xxl },

  // ── Follow route section ──
  followSection: {
    backgroundColor: colours.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colours.border,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  followSectionInfo:  { marginBottom: spacing.md },
  followSectionTitle: { color: colours.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  followSectionMeta:  { color: colours.textSecondary, fontSize: 13, marginTop: 4 },
  followSectionDesc:  { color: colours.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },

  followBtn: {
    backgroundColor: colours.sun,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  followBtnLabel: { color: colours.bg, fontSize: 16, fontWeight: '700' },

  followDisclaimer: {
    color: colours.textTertiary,
    fontSize: 11, lineHeight: 16,
    marginTop: spacing.sm, textAlign: 'center',
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colours.bgCard,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
    borderTopWidth: 1, borderColor: colours.border,
  },
  modalTitle: {
    color: colours.textPrimary, fontSize: 18,
    fontWeight: '600', letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  modalBody: {
    color: colours.textSecondary, fontSize: 14,
    lineHeight: 21, marginBottom: spacing.sm,
  },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalCancel: {
    flex: 1, backgroundColor: colours.bgElevated,
    borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1, borderColor: colours.border,
  },
  modalCancelLabel: { color: colours.textSecondary, fontSize: 15, fontWeight: '500' },
  modalConfirm: {
    flex: 1, backgroundColor: colours.sun,
    borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalConfirmLabel: { color: colours.bg, fontSize: 15, fontWeight: '700' },
});