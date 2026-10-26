import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/store/auth";

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: PropsWithChildren<{ requireAdmin?: boolean }>) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.loadingSafeArea}>
        <ActivityIndicator size="large" color="#3159b8" />
        <Text style={styles.loadingText}>Loading Service Desk…</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  if (requireAdmin && user.role !== "admin") {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingSafeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f6fa",
    gap: 12,
  },
  loadingText: {
    color: "#17243d",
    fontWeight: "800",
    fontSize: 18,
  },
});
