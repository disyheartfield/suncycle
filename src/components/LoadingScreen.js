/**
 * LoadingScreen.js
 * Full-screen loading overlay shown while ShadeMap calculates shadows.
 * The sun fills up from bottom to top as each route is scored.
 *
 * Props:
 *   progress  — number 0 to 1 (e.g. 0.33 after route 1 of 3)
 *   message   — string shown below the sun (optional)
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colours, spacing } from '../theme';

const SUN_SIZE    = 68;     // diameter of the sun circle
const RAY_W       = 3;      // ray width
const RAY_H       = 10;     // ray length
const RAY_ORBIT   = SUN_SIZE / 2 + 9;  // distance from centre to mid-ray
const NUM_RAYS    = 12;
const CENTRE      = 80;     // centre of the overall drawing area
const AREA        = CENTRE * 2;

export default function LoadingScreen({ progress = 0, message = '' }) {
  const fillAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animate the fill whenever progress changes
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: Math.min(Math.max(progress, 0), 1),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Gentle heartbeat pulse on the whole sun
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    ).start();
    return () => pulseAnim.stopAnimation();
  }, []);

  // Height of the golden fill inside the circle (rises from 0 to SUN_SIZE)
  const fillHeight = fillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, SUN_SIZE],
  });

  // Build ray positions around the circle
  const rays = Array.from({ length: NUM_RAYS }, (_, i) => {
    const deg = (i / NUM_RAYS) * 360;
    const rad = (deg * Math.PI) / 180;
    return {
      key:  i,
      left: CENTRE + Math.sin(rad) * RAY_ORBIT - RAY_W  / 2,
      top:  CENTRE - Math.cos(rad) * RAY_ORBIT - RAY_H  / 2,
      deg,
    };
  });

  return (
    <View style={styles.overlay}>

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        {/* Drawing area — sun body + rays all positioned within this square */}
        <View style={styles.area}>

          {/* Rays */}
          {rays.map(({ key, left, top, deg }) => (
            <View
              key={key}
              style={[
                styles.ray,
                {
                  left,
                  top,
                  transform: [{ rotate: `${deg}deg` }],
                },
              ]}
            />
          ))}

          {/* Sun circle with rising fill */}
          <View style={styles.sunOuter}>
            {/* Dark background fills the whole circle */}
            <View style={styles.sunDark} />
            {/* Golden fill rises from the bottom */}
            <Animated.View style={[styles.sunFill, { height: fillHeight }]} />
          </View>

        </View>
      </Animated.View>

      <Text style={styles.title}>Finding your sunniest route</Text>
      <Text style={styles.sub}>
        {message || 'Calculating building shadows…'}
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:1,
    backgroundColor: colours.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  area: {
    width:  AREA,
    height: AREA,
  },

  ray: {
    position:     'absolute',
    width:        RAY_W,
    height:       RAY_H,
    borderRadius: RAY_W / 2,
    backgroundColor: colours.sunWarm,
    opacity: 0.6,
  },

  // The circle — overflow hidden clips the rising fill
  sunOuter: {
    position:     'absolute',
    width:        SUN_SIZE,
    height:       SUN_SIZE,
    borderRadius: SUN_SIZE / 2,
    left:         CENTRE - SUN_SIZE / 2,
    top:          CENTRE - SUN_SIZE / 2,
    overflow:     'hidden',
    backgroundColor: colours.bgElevated,
  },

  // Dark backing (whole circle)
  sunDark: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colours.bgElevated,
  },

  // Golden fill — sits at the BOTTOM of the circle, height grows upward
  sunFill: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: colours.sun,
  },

  title: {
    color:        colours.textPrimary,
    fontSize:     17,
    fontWeight:   '600',
    letterSpacing: -0.3,
    marginTop:    spacing.xl,
  },

  sub: {
    color:      colours.textSecondary,
    fontSize:   13,
    marginTop:  spacing.sm,
  },
});