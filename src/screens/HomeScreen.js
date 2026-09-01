import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, KeyboardAvoidingView,
  Platform, StatusBar, ActivityIndicator, Modal,
} from "react-native";
import { colours, radius, spacing } from "../theme";
import { fetchRoutes, APIError } from "../api";

export default function HomeScreen({ navigation }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // No custom selection means "now" at the moment Search is pressed.
  const initialTime = useRef(new Date()).current;
  const [hasCustomTime, setHasCustomTime] = useState(false);
  const [departureHour, setDepartureHour] = useState(initialTime.getHours());
  const [departureMin, setDepartureMin]  = useState(initialTime.getMinutes());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(initialTime.getHours());
  const [pickerMin, setPickerMin]   = useState(initialTime.getMinutes());

  const titleAnim  = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(30)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleAnim,   { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(cardAnim,    { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const departureLabel = () => {
    if (!hasCustomTime) return "Now";
    const h = String(departureHour).padStart(2, "0");
    const m = String(departureMin).padStart(2, "0");
    return `${h}:${m}`;
  };

  const buildDepartureAt = () => {
    const departure = new Date();
    if (hasCustomTime) {
      departure.setHours(departureHour, departureMin, 0, 0);
    }
    return departure;
  };

  const openPicker = () => {
    const current = new Date();
    setPickerHour(hasCustomTime ? departureHour : current.getHours());
    setPickerMin(hasCustomTime ? departureMin : current.getMinutes());
    setShowTimePicker(true);
  };

  const confirmTime = () => {
    setDepartureHour(pickerHour);
    setDepartureMin(pickerMin);
    setHasCustomTime(true);
    setShowTimePicker(false);
  };

  const useCurrentTime = () => {
    const current = new Date();
    setDepartureHour(current.getHours());
    setDepartureMin(current.getMinutes());
    setPickerHour(current.getHours());
    setPickerMin(current.getMinutes());
    setHasCustomTime(false);
    setShowTimePicker(false);
  };

  const handleSearch = async () => {
    if (!start.trim() || !end.trim()) {
      setError("Enter both postcodes to find your sunniest route");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await fetchRoutes(start, end, buildDepartureAt());
      navigation.navigate("Routes", { data, start, end });
    } catch (e) {
      if (e instanceof APIError) {
        setError(e.message);
      } else if (e.message?.includes("Network")) {
        setError("Can't reach the server — is it running?");
      } else {
        setError(e.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const titleOpacity = titleAnim;
  const titleY = titleAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });

  // Quick hours for the picker
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINS  = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.bgGlow} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
        <Text style={styles.logoMark}>☀</Text>
        <Text style={styles.logoText}>SunCycle</Text>
        <Text style={styles.tagline}>Find your sunniest route</Text>
      </Animated.View>

      {/* Search card */}
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardAnim }] }]}>

        {/* From */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>FROM</Text>
          <View style={styles.inputRow}>
            <View style={[styles.dot, styles.dotFrom]} />
            <TextInput
              style={styles.input}
              placeholder="Start postcode"
              placeholderTextColor={colours.textTertiary}
              value={start}
              onChangeText={setStart}
              autoCapitalize="characters"
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Swap divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={() => { setStart(end); setEnd(start); }}>
            <Text style={styles.swapIcon}>⇅</Text>
          </TouchableOpacity>
          <View style={styles.dividerLine} />
        </View>

        {/* To */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>TO</Text>
          <View style={styles.inputRow}>
            <View style={[styles.dot, styles.dotTo]} />
            <TextInput
              style={styles.input}
              placeholder="End postcode"
              placeholderTextColor={colours.textTertiary}
              value={end}
              onChangeText={setEnd}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Departure time */}
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>DEPART</Text>
          <TouchableOpacity style={styles.timeBtn} onPress={openPicker}>
            <Text style={styles.timeBtnIcon}>🕐</Text>
            <Text style={styles.timeBtnText}>{departureLabel()}</Text>
            <Text style={styles.timeBtnChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaLoading]}
          onPress={handleSearch}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.ctaLoadingContent}>
              <ActivityIndicator size="small" color={colours.bg} />
              <Text style={styles.ctaLoadingText}>Finding sunny routes…</Text>
            </View>
          ) : (
            <Text style={styles.ctaText}>Find Sunniest Route ☀</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Quick tries */}
      <View style={styles.quickTries}>
        <Text style={styles.quickLabel}>Try</Text>
        {[["N19 3DA", "SE1 7PB"], ["EC1A 1BB", "SE1 7PB"]].map(([s, e]) => (
          <TouchableOpacity key={s} style={styles.quickBtn} onPress={() => { setStart(s); setEnd(e); }}>
            <Text style={styles.quickText}>{s} → {e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time picker modal */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Departure time</Text>
            <Text style={styles.modalSub}>
              Shadows change throughout the day — try morning vs midday vs evening
            </Text>

            {/* Hour + minute selectors */}
            <View style={styles.pickerRow}>
              {/* Hours */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>HOUR</Text>
                <View style={styles.pickerGrid}>
                  {HOURS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.pickerCell, pickerHour === h && styles.pickerCellActive]}
                      onPress={() => setPickerHour(h)}
                    >
                      <Text style={[styles.pickerCellText, pickerHour === h && styles.pickerCellTextActive]}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.pickerColon}>:</Text>

              {/* Minutes */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>MIN</Text>
                <View style={styles.pickerGrid}>
                  {MINS.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickerCell, pickerMin === m && styles.pickerCellActive]}
                      onPress={() => setPickerMin(m)}
                    >
                      <Text style={[styles.pickerCellText, pickerMin === m && styles.pickerCellTextActive]}>
                        {String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Preview */}
            <Text style={styles.pickerPreview}>
              {String(pickerHour).padStart(2, "0")}:{String(pickerMin).padStart(2, "0")}
            </Text>

            <TouchableOpacity style={styles.nowBtn} onPress={useCurrentTime}>
              <Text style={styles.nowBtnText}>Use current time</Text>
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmTime}>
                <Text style={styles.modalConfirmText}>Set time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.bg, paddingHorizontal: spacing.lg, paddingTop: 80 },
  bgGlow: { position: "absolute", top: -100, left: "25%", width: 200, height: 200, borderRadius: 100, backgroundColor: colours.sun, opacity: 0.04 },
  header: { alignItems: "center", marginBottom: spacing.xl },
  logoMark: { fontSize: 40, marginBottom: spacing.xs },
  logoText: { fontSize: 32, fontFamily: "Georgia", fontWeight: "700", color: colours.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: 15, color: colours.textSecondary, marginTop: spacing.xs },
  card: { backgroundColor: colours.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colours.border, padding: spacing.lg },
  inputGroup: { gap: spacing.xs },
  inputLabel: { fontSize: 10, fontWeight: "600", color: colours.textTertiary, letterSpacing: 1.2 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotFrom: { backgroundColor: colours.sun },
  dotTo: { backgroundColor: colours.shade },
  input: { flex: 1, fontSize: 18, fontWeight: "500", color: colours.textPrimary, paddingVertical: spacing.sm, letterSpacing: 0.5 },
  dividerRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colours.border },
  swapBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colours.bgElevated, borderWidth: 1, borderColor: colours.border, alignItems: "center", justifyContent: "center" },
  swapIcon: { color: colours.textSecondary, fontSize: 14, fontWeight: "600" },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colours.border },
  timeLabel: { fontSize: 10, fontWeight: "600", color: colours.textTertiary, letterSpacing: 1.2 },
  timeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colours.bgElevated, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colours.border },
  timeBtnIcon: { fontSize: 13 },
  timeBtnText: { fontSize: 13, fontWeight: "500", color: colours.textPrimary },
  timeBtnChevron: { fontSize: 16, color: colours.textTertiary, marginLeft: 2 },
  errorText: { color: colours.error, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
  cta: { backgroundColor: colours.sun, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  ctaLoading: { backgroundColor: colours.sunWarm, opacity: 0.8 },
  ctaLoadingContent: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ctaText: { color: colours.bg, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  ctaLoadingText: { color: colours.bg, fontSize: 15, fontWeight: "600" },
  quickTries: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  quickLabel: { color: colours.textTertiary, fontSize: 12 },
  quickBtn: { backgroundColor: colours.bgCard, borderRadius: radius.full, borderWidth: 1, borderColor: colours.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  quickText: { color: colours.textSecondary, fontSize: 12, fontWeight: "500" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colours.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  modalTitle: { color: colours.textPrimary, fontSize: 18, fontWeight: "600", letterSpacing: -0.3, marginBottom: 4 },
  modalSub: { color: colours.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: spacing.lg },
  pickerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pickerCol: { flex: 1 },
  pickerLabel: { fontSize: 10, fontWeight: "600", color: colours.textTertiary, letterSpacing: 1.2, marginBottom: 8, textAlign: "center" },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  pickerCell: { width: 44, height: 36, borderRadius: radius.sm, backgroundColor: colours.bgElevated, borderWidth: 1, borderColor: colours.border, alignItems: "center", justifyContent: "center" },
  pickerCellActive: { backgroundColor: colours.sun, borderColor: colours.sun },
  pickerCellText: { fontSize: 13, fontWeight: "500", color: colours.textSecondary },
  pickerCellTextActive: { color: colours.bg, fontWeight: "700" },
  pickerColon: { fontSize: 28, color: colours.textTertiary, marginTop: 36, fontWeight: "300" },
  pickerPreview: { fontFamily: "Georgia", fontSize: 40, fontWeight: "700", color: colours.sun, textAlign: "center", marginVertical: spacing.lg, letterSpacing: -2 },
  nowBtn: { alignSelf: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
  nowBtnText: { color: colours.sun, fontSize: 13, fontWeight: "600" },
  modalBtns: { flexDirection: "row", gap: spacing.sm },
  modalCancel: { flex: 1, backgroundColor: colours.bgElevated, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colours.border },
  modalCancelText: { color: colours.textSecondary, fontSize: 15, fontWeight: "500" },
  modalConfirm: { flex: 1, backgroundColor: colours.sun, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  modalConfirmText: { color: colours.bg, fontSize: 15, fontWeight: "700" },
});