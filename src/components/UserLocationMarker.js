/**
 * UserLocationMarker.js
 *
 * Renders a blue location dot with an optional translucent direction cone
 * on a react-native-maps MapView.
 *
 * Design rationale:
 *  - Blue keeps the dot clearly distinct from the yellow route line and
 *    the yellow start / destination markers already on the map.
 *  - A white ring provides contrast over dark roads, parks and water.
 *  - The cone opens in the direction the phone is pointing — NOT a route
 *    instruction. It disappears when heading data is unavailable or
 *    inaccurate so it never misleads.
 *
 * Geometry:
 *  - The Marker anchor is set to (0.5, 0.5) so the centre of the
 *    container view lands exactly on the coordinate.
 *  - The cone is a triangle with its apex at that centre, opening
 *    upward (northward) by default. Rotating the wrapper by `heading`
 *    degrees pivots the cone around the dot.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

// ── Geometry constants ────────────────────────────────────────────────────────

const DOT_RADIUS    = 9;   // inner blue disc
const RING_WIDTH    = 2;   // white outer ring

const CONE_HEIGHT   = 52;  // length of the cone from apex to base
const CONE_HW       = 18;  // half-width of the cone at its base

/**
 * The container must be large enough to hold the cone in every rotation.
 * Worst-case diagonal ≈ √(CONE_HEIGHT² + (CONE_HW×2)²) ≈ 60 px.
 * Add comfortable margin; keep it as small as practical.
 */
const CONTAINER = 130;
const CENTER    = CONTAINER / 2; // 65

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserLocationMarker({ coordinate, heading }) {
  if (!coordinate) return null;

  const showCone =
    heading?.showCone === true &&
    typeof heading?.degrees === 'number' &&
    isFinite(heading.degrees);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      accessibilityLabel="Your current location"
      accessibilityRole="image"
      accessibilityHint="Blue dot showing where you are on the map"
    >
      <View style={styles.container}>

        {/*
          Direction cone.
          The wrapper fills the container and rotates around its own centre,
          which is the same point as the location dot.
          A border-top triangle has its apex at the BOTTOM of the element,
          so positioning it with the apex at CENTER opens the wide part
          upward — that is, northward when heading is 0.
        */}
        {showCone && (
          <View
            style={[
              styles.coneWrapper,
              { transform: [{ rotate: `${heading.degrees}deg` }] },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.cone} />
          </View>
        )}

        {/* Location dot — layered on top of the cone */}
        <View style={styles.dotOuter}>
          <View style={styles.dotInner} />
        </View>

      </View>
    </Marker>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width:  CONTAINER,
    height: CONTAINER,
    alignItems:     'center',
    justifyContent: 'center',
  },

  /**
   * coneWrapper fills the container so its centre is at CENTER × CENTER.
   * Rotating it by `heading` degrees pivots the cone around the dot.
   */
  coneWrapper: {
    position: 'absolute',
    width:    CONTAINER,
    height:   CONTAINER,
  },

  /**
   * Border-top triangle — apex at the bottom, wide part at the top.
   *
   * Bounding box: CONE_HW*2 wide × CONE_HEIGHT tall.
   * Apex lands at (CENTER, CENTER) in container coords:
   *   left = CENTER - CONE_HW        → 65 - 18 = 47
   *   top  = CENTER - CONE_HEIGHT    → 65 - 52 = 13
   *
   * So the filled area runs from y = 13 (wide base) down to y = 65 (apex),
   * opening upward — northward by default.
   */
  cone: {
    position: 'absolute',
    top:  CENTER - CONE_HEIGHT,
    left: CENTER - CONE_HW,
    width:  0,
    height: 0,
    borderLeftWidth:  CONE_HW,
    borderRightWidth: CONE_HW,
    borderTopWidth:   CONE_HEIGHT,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    borderTopColor:   'rgba(41, 128, 255, 0.28)',
  },

  dotOuter: {
    width:        (DOT_RADIUS + RING_WIDTH) * 2,
    height:       (DOT_RADIUS + RING_WIDTH) * 2,
    borderRadius:  DOT_RADIUS + RING_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems:     'center',
    justifyContent: 'center',
    // Shadow keeps the dot legible over the yellow route
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius:  2.5,
    elevation:     4,
  },

  dotInner: {
    width:        DOT_RADIUS * 2,
    height:       DOT_RADIUS * 2,
    borderRadius: DOT_RADIUS,
    backgroundColor: '#2980FF',
  },
});