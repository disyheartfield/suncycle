// RouteCard.js — Premium route card with sun score, tags, strip

import React, { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Animated, StyleSheet
} from "react-native";
import { colours, radius, spacing, shadows, sunScoreColour } from "../theme";
import SunScore from "./SunScore";

export default function RouteCard({ route, selected, onPress, delay = 0 }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 60,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const scoreColour = sunScoreColour(route.sun_percent);
  const isSelected = selected;

  return (
    <Animated.View style={{
      opacity: opacityAnim,
      transform: [
        { translateY: slideAnim },
        { scale: scaleAnim },
      ],
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[
          styles.card,
          isSelected && styles.cardSelected,
          isSelected && { borderColor: scoreColour + "60" },
        ]}>

          {/* Tags row */}
          <View style={styles.tagsRow}>
            {route.is_sunniest && <Tag label="SUNNIEST" colour={colours.sun} />}
            {route.is_fastest && <Tag label="FASTEST" colour={colours.shade} />}
            {!route.is_sunniest && !route.is_fastest && (
              <Tag label="ALTERNATIVE" colour={colours.textTertiary} />
            )}
          </View>

          {/* Main content */}
          <View style={styles.mainRow}>
            {/* Left: score */}
            <SunScore percent={route.sun_percent} size="large" />

            {/* Right: details */}
            <View style={styles.details}>
              <Text style={styles.description}>{route.description}</Text>

              <View style={styles.metaRow}>
                <MetaItem icon="🕐" value={`${route.duration_min} min`} />
                <MetaItem icon="📍" value={`${route.distance_km} km`} />
                <MetaItem icon="☀" value={`${route.sunny_km} km sun`} />
              </View>

              {/* Sun strip */}
              <SunStrip segments={route.segments} />
            </View>
          </View>

          {/* Score bar */}
          <View style={styles.scoreBarTrack}>
            <Animated.View style={[
              styles.scoreBarFill,
              {
                width: `${route.sun_percent}%`,
                backgroundColor: scoreColour,
              }
            ]} />
          </View>

          {/* Selected indicator */}
          {isSelected && (
            <View style={[styles.selectedLine, { backgroundColor: scoreColour }]} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function Tag({ label, colour }) {
  return (
    <View style={[styles.tag, { backgroundColor: colour + "20", borderColor: colour + "40" }]}>
      <Text style={[styles.tagText, { color: colour }]}>{label}</Text>
    </View>
  );
}

function MetaItem({ icon, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SunStrip({ segments }) {
  // Mini horizontal strip showing sun/shade pattern
  if (!segments || segments.length === 0) return null;
  const total = segments.reduce((sum, s) => sum + s.coordinates.length, 0);

  return (
    <View style={styles.strip}>
      {segments.map((seg, i) => {
        const width = `${(seg.coordinates.length / total) * 100}%`;
        return (
          <View
            key={i}
            style={[
              styles.stripSegment,
              {
                width,
                backgroundColor: seg.in_sun
                  ? colours.sun + "CC"
                  : colours.shade + "55",
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colours.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  cardSelected: {
    backgroundColor: colours.bgElevated,
    borderWidth: 1.5,
  },
  selectedLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  details: {
    flex: 1,
    gap: spacing.xs,
  },
  description: {
    color: colours.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaIcon: { fontSize: 11 },
  metaValue: {
    fontSize: 12,
    color: colours.textSecondary,
    fontWeight: "500",
  },
  strip: {
    flexDirection: "row",
    height: 4,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.xs,
    backgroundColor: colours.bgElevated,
  },
  stripSegment: {
    height: "100%",
  },
  scoreBarTrack: {
    height: 2,
    backgroundColor: colours.bgElevated,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: radius.full,
  },
});
