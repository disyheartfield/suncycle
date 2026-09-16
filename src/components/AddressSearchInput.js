import React, { forwardRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { colours, radius, spacing } from "../theme";
import { useLocationSearch } from "../hooks/useLocationSearch";

const AddressSearchInput = forwardRef(function AddressSearchInput({
  label, value, selected, active, disabled, dotColour,
  onChangeText, onSelect, onFocus, onSubmitEditing, returnKeyType,
}, ref) {
  const search = useLocationSearch(value, active && !selected && !disabled);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: dotColour }]} />
        <TextInput
          ref={ref}
          style={styles.input}
          accessibilityLabel={`${label === "FROM" ? "Start" : "Destination"} address or postcode`}
          placeholder="Place, address or postcode"
          placeholderTextColor={colours.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!disabled}
          maxLength={200}
        />
        {!!value && (
          <TouchableOpacity
            style={styles.clear}
            disabled={disabled}
            onPress={() => { onChangeText(""); ref?.current?.focus(); }}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label === "FROM" ? "start" : "destination"}`}
          >
            <Text style={styles.clearText}>×</Text>
          </TouchableOpacity>
        )}
      </View>
      {selected && (
        <Text style={styles.selected}>
          Selected{selected.type === "postcode" ? " · postcode area" : selected.type === "street" ? " · street location" : ""}
        </Text>
      )}
      {search.status === "loading" && (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colours.sun} />
          <Text style={styles.hint}>Finding places…</Text>
        </View>
      )}
      {search.status === "error" && (
        <View style={styles.results}>
          <Text style={styles.error} accessibilityLiveRegion="polite">{search.error}</Text>
          <TouchableOpacity onPress={search.retry} style={styles.retry} accessibilityRole="button">
            <Text style={styles.selected}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
      {search.status === "done" && (
        <View style={styles.results}>
          {search.items.length === 0 ? (
            <Text style={styles.hint}>No matching places. Add a street or town, or try a full postcode.</Text>
          ) : search.items.map((place, index) => (
            <TouchableOpacity
              key={`${place.id}-${index}`}
              style={styles.suggestion}
              onPress={() => onSelect(place)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${place.label}`}
            >
              <Text style={styles.title}>{place.title}</Text>
              <Text style={styles.hint}>{place.label}</Text>
              {place.type === "postcode" && <Text style={styles.hint}>Postcode area</Text>}
              {place.type === "street" && <Text style={styles.hint}>Street location · add a house number for more detail</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

export default AddressSearchInput;

const styles = StyleSheet.create({
  label: { fontSize: 10, fontWeight: "600", color: colours.textTertiary, letterSpacing: 1.2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  input: { flex: 1, minWidth: 0, fontSize: 16, color: colours.textPrimary, paddingVertical: spacing.md },
  clear: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  clearText: { color: colours.textSecondary, fontSize: 24 },
  selected: { color: colours.sun, fontSize: 12, marginBottom: spacing.xs },
  status: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  results: { borderTopWidth: 1, borderColor: colours.border, paddingTop: spacing.sm },
  suggestion: { padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colours.bgElevated, borderRadius: radius.sm },
  title: { color: colours.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 3 },
  hint: { color: colours.textSecondary, fontSize: 12, lineHeight: 18 },
  error: { color: colours.error, fontSize: 12, lineHeight: 18 },
  retry: { paddingVertical: spacing.sm, alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
});
