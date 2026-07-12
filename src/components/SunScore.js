// SunScore.js — Animated sun percentage display
// The hero element of every route card

import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { colours, sunScoreColour, sunEmoji, radius, spacing } from "../theme";

export default function SunScore({ percent, size = "large", animated = true }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle pulse glow for high sun scores
    if (percent >= 70) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [percent]);

  const colour = sunScoreColour(percent);
  const isLarge = size === "large";

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  return (
    <Animated.View style={[
      styles.container,
      isLarge ? styles.large : styles.small,
      { opacity, transform: [{ scale }] },
    ]}>
      {/* Glow ring */}
      {percent >= 70 && (
        <Animated.View style={[
          styles.glowRing,
          {
            borderColor: colour,
            opacity: glowOpacity,
            width: isLarge ? 100 : 64,
            height: isLarge ? 100 : 64,
            borderRadius: isLarge ? 50 : 32,
          }
        ]} />
      )}

      <Text style={[styles.emoji, isLarge ? styles.emojiLarge : styles.emojiSmall]}>
        {sunEmoji(percent)}
      </Text>

      <Text style={[
        styles.number,
        { color: colour },
        isLarge ? styles.numberLarge : styles.numberSmall,
      ]}>
        {Math.round(percent)}%
      </Text>

      <Text style={[styles.label, isLarge ? styles.labelLarge : styles.labelSmall]}>
        sun
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  large: {
    width: 90,
    height: 90,
  },
  small: {
    width: 56,
    height: 56,
  },
  glowRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  emoji: {
    lineHeight: undefined,
  },
  emojiLarge: { fontSize: 22, marginBottom: 2 },
  emojiSmall: { fontSize: 14, marginBottom: 1 },
  number: {
    fontFamily: "Georgia",
    fontWeight: "700",
    letterSpacing: -1,
  },
  numberLarge: { fontSize: 28, lineHeight: 30 },
  numberSmall: { fontSize: 18, lineHeight: 20 },
  label: {
    color: colours.textSecondary,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  labelLarge: { fontSize: 10, marginTop: 2 },
  labelSmall: { fontSize: 8, marginTop: 1 },
});
