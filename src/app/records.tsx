import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchWorkSessions,
  startWorkSession,
  stopWorkSession,
} from "@/api/tickets";
import { errorMessage } from "@/api/client";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { WorkSessionSummary } from "@/types";
import { formatDuration } from "@/utils/format";

const emptySummary: WorkSessionSummary = {
  sessions: [],
  activeSession: null,
  trackedSecondsToday: 0,
  sessionsToday: 0,
};

export default function RecordsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [summary, setSummary] = useState<WorkSessionSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(0);
  const [clock, setClock] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchWorkSessions();
      setSummary(result);
      setRefreshedAt(Date.now());
      setError("");
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void load(), 0);
    const refresh = setInterval(() => void load(), 30_000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  const handleSessionToggle = async () => {
    setUpdating(true);
    setError("");
    try {
      if (summary.activeSession) {
        await stopWorkSession(summary.activeSession.id);
      } else {
        await startWorkSession();
      }
      await load();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setError("");
      await signOut();
      router.replace("/");
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setLoggingOut(false);
    }
  };

  const liveSeconds = summary.activeSession
    ? Math.floor((clock - refreshedAt) / 1000)
    : 0;
  const trackedSeconds = summary.trackedSecondsToday + liveSeconds;
  const metrics = [
    {
      label: "Tracked today",
      value: formatDuration(trackedSeconds),
      tone: "#5d7cff",
    },
    {
      label: "Sessions today",
      value: String(summary.sessionsToday),
      tone: "#34d399",
    },
    {
      label: "Current status",
      value: summary.activeSession ? "Active" : "Stopped",
      tone: "#f97316",
    },
  ];

  return (
    <ProtectedRoute>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader title="Work records">
            <View style={styles.navbarActions}>
              <Link href="/" replace asChild>
                <Text style={styles.homeLink}>Dashboard →</Text>
              </Link>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                disabled={loggingOut}
                onPress={() => {
                  void handleLogout();
                }}
                style={[
                  styles.logoutButton,
                  loggingOut && styles.logoutButtonDisabled,
                ]}
              >
                <Text style={styles.logoutText}>
                  {loggingOut ? "Logging out…" : "Log out"}
                </Text>
              </Pressable>
            </View>
          </ScreenHeader>
          {error ? (
            <Text accessibilityRole="alert" style={styles.logoutError}>
              {error}
            </Text>
          ) : null}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.heading}>Work record</Text>
              <Pressable
                accessibilityRole="button"
                disabled={loading || updating}
                onPress={() => {
                  void handleSessionToggle();
                }}
                style={[
                  styles.sessionButton,
                  (loading || updating) && styles.disabled,
                ]}
              >
                <Text style={styles.sessionButtonText}>
                  {loading
                    ? "Loading…"
                    : updating
                      ? "Saving…"
                      : summary.activeSession
                        ? "Stop session"
                        : "Start session"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.metricRow}>
              {metrics.map((item) => (
                <View key={item.label} style={styles.metricCard}>
                  <Text
                    style={[styles.metricDot, { backgroundColor: item.tone }]}
                  />
                  <Text style={styles.metricValue}>{item.value}</Text>
                  <Text style={styles.metricLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.title}>Service timeline</Text>
              <Text style={styles.filterTag}>Latest 100</Text>
            </View>

            {loading ? (
              <Text style={styles.empty}>Loading work sessions…</Text>
            ) : null}
            {!loading && summary.sessions.length === 0 ? (
              <Text style={styles.empty}>
                No work sessions yet. Start a session to begin tracking your
                time.
              </Text>
            ) : null}
            {summary.sessions.map((session, index) => {
              const active = session.status === "active";
              const accent = active ? "#34d399" : "#5d7cff";
              const duration =
                session.durationSeconds + (active ? liveSeconds : 0);
              return (
                <View key={session.id} style={styles.recordRow}>
                  <View style={styles.dotWrap}>
                    <View style={[styles.dot, { backgroundColor: accent }]} />
                    {index < summary.sessions.length - 1 ? (
                      <View style={styles.connector} />
                    ) : null}
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordTitle}>
                      {active
                        ? "Work session started"
                        : "Work session completed"}
                    </Text>
                    <Text style={styles.recordMeta}>
                      {new Date(session.startedAt).toLocaleString()} ·{" "}
                      {formatDuration(duration)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateTag,
                      { backgroundColor: `${accent}22`, color: accent },
                    ]}
                  >
                    {active ? "Active" : "Completed"}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f8fa" },
  container: {
    padding: 18,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  navbar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navbarActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  homeLink: { color: "#38539b", fontWeight: "800", fontSize: 12, padding: 8 },
  logoutButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f2",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  logoutButtonDisabled: { opacity: 0.6 },
  logoutText: { color: "#b42318", fontSize: 12, fontWeight: "800" },
  logoutError: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 12,
  },
  header: {
    borderRadius: 10,
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ebef",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { color: "#20252c", fontSize: 24, fontWeight: "700" },
  sessionButton: {
    backgroundColor: "#24845d",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sessionButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  empty: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 12,
  },
  link: {   color: "#24845d", fontWeight: "700" },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e8ebef",
  },
  metricDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  metricValue: {
    color: "#20252c",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  metricLabel: { color: "#78828e", fontSize: 11 },
  panel: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e7ebf3",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#17264b" },
  filterTag: {
    color: "#1f5cff",
    backgroundColor: "#edf3ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: "800",
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  dotWrap: { width: 18, alignItems: "center", marginRight: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  connector: { width: 2, height: 36, backgroundColor: "#dfe7ff", marginTop: 6 },
  recordBody: { flex: 1 },
  recordTitle: { color: "#17264b", fontWeight: "700", fontSize: 14 },
  recordMeta: { color: "#6b7280", fontSize: 12, marginTop: 4 },
  stateTag: {
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
});
