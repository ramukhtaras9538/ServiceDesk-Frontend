import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, Text, useColorScheme, View } from "react-native";

import { BrandMark } from "@/components/brand-mark";
import { Colors } from "@/constants/theme";

export function ScreenHeader({
  children,
  title = "Service Desk",
}: PropsWithChildren<{ title?: string }>) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  return (
    <View
      style={[
        styles.header,
        Platform.OS === "web" && styles.webHeader,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: isDark ? "#2b3850" : "#e5eaf2",
        },
      ]}
    >
      {Platform.OS === "web" ? (
        <Text style={styles.title}>{title}</Text>
      ) : (
        <BrandMark compact inverse={isDark} />
      )}
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#23365b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  webHeader: {
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  title: {
    color: "#20252c",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 6,
  },
});
