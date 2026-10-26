import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/store/auth";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const hydrate = useAuth((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: isDark ? "#111827" : "#f4f6fa",
            },
          }}
        />
      </AppShell>
    </>
  );
}
