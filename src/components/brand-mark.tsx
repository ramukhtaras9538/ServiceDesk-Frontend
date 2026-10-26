import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export function BrandMark({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={styles.brand}>
      <LinearGradient
        colors={inverse ? ["#fff", "#e7edff"] : ["#1d3768", "#4269c7"]}
        style={[styles.emblem, compact && styles.emblemCompact]}
      >
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={compact ? 20 : 25}
          color={inverse ? "#263c84" : "#fff"}
        />
      </LinearGradient>
      <View>
        <Text
          style={[
            styles.name,
            inverse && styles.nameInverse,
            compact && styles.nameCompact,
          ]}
        >
          PSG
        </Text>
        <Text
          style={[
            styles.caption,
            inverse && styles.captionInverse,
            compact && styles.captionCompact,
          ]}
        >
          SERVICE DESK
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  emblem: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emblemCompact: { width: 38, height: 38, borderRadius: 13 },
  name: {
    color: "#17243d",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.1,
    lineHeight: 20,
  },
  nameInverse: { color: "#fff" },
  nameCompact: { fontSize: 16 },
  caption: {
    color: "#78859a",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 3,
  },
  captionInverse: { color: "rgba(255,255,255,0.68)" },
  captionCompact: { fontSize: 8, letterSpacing: 1.25 },
});
