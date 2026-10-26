import { Link, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Page not found" }} />
      <Text style={styles.emoji}>🧭</Text>
      <Text style={styles.title}>This page is off-route</Text>
      <Text style={styles.subtitle}>
        The screen you were looking for doesn’t exist yet.
      </Text>
      <Link href="/" replace asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Back to dashboard</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f7ff",
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    color: "#59657d",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#1f5cff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
