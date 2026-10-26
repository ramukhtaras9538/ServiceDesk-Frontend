import { Link, Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cancelLeave, createLeave, fetchLeaves } from "@/api/tickets";
import { errorMessage } from "@/api/client";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { LeaveRecord } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

export default function LeaveScreen() {
  const user = useAuth((state) => state.user);
  const isAgent = user?.role === "agent";
  const isAdmin = user?.role === "admin";
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const items = await fetchLeaves();
    setLeaves(items);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const items = await fetchLeaves();
        if (active) {
          setLeaves(items);
          setError("");
        }
      } catch (reason: unknown) {
        if (active) setError(errorMessage(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const submit = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const leave = await createLeave({ startDate, endDate });
      setLeaves((current) => [leave, ...current]);
      setNotice(
        "Your leave is scheduled. Assigned tickets will be covered on the start date.",
      );
      try {
        await load();
      } catch (reason: unknown) {
        setError(
          `Leave was scheduled, but the list could not be refreshed: ${errorMessage(reason)}`,
        );
      }
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (leave: LeaveRecord) => {
    setBusyId(leave.id);
    setError("");
    setNotice("");
    try {
      const cancelled = await cancelLeave(leave.id);
      setLeaves((current) =>
        current.map((item) => (item.id === leave.id ? cancelled : item)),
      );
      setNotice(`${leave.agent.name}’s leave was cancelled.`);
      try {
        await load();
      } catch (reason: unknown) {
        setError(
          `Leave was cancelled, but the list could not be refreshed: ${errorMessage(reason)}`,
        );
      }
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      {!isAgent && !isAdmin ? (
        <Redirect href="/" />
      ) : (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <ScreenHeader title="Resolver leave">
              <Link href="/" replace asChild>
                <Text style={styles.navLink}>Dashboard →</Text>
              </Link>
            </ScreenHeader>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>RESOLVER AVAILABILITY</Text>
              <Text style={styles.title}>Leave</Text>
              <Text style={styles.subtitle}>
                On leave dates, unresolved tickets are covered by the
                least-loaded available resolver and returned when leave ends.
              </Text>
            </View>

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}

            {isAgent ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Schedule your leave</Text>
                <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
                <TextInput
                  accessibilityLabel="Leave start date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-10-23"
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  style={styles.input}
                />
                <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
                <TextInput
                  accessibilityLabel="Leave end date"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-10-23"
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void submit()}
                  style={[styles.primaryButton, saving && styles.disabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? "Scheduling…" : "Schedule leave"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                {isAdmin ? "Resolver leave schedule" : "Your leave"}
              </Text>
              {loading ? (
                <Text style={styles.empty}>Loading leave…</Text>
              ) : null}
              {!loading && leaves.length === 0 ? (
                <Text style={styles.empty}>No leave records yet.</Text>
              ) : null}
              {leaves.map((leave) => {
                const canCancel =
                  leave.status === "scheduled" ||
                  (isAdmin && leave.status === "active");
                return (
                  <View key={leave.id} style={styles.leaveRow}>
                    <View style={styles.leaveDetails}>
                      <Text style={styles.agentName}>
                        {leave.agent.name} ({leave.agent.empId})
                      </Text>
                      <Text style={styles.dateRange}>
                        {leave.startDate} – {leave.endDate}
                      </Text>
                      <Text style={styles.status}>
                        {leave.status.toUpperCase()}
                      </Text>
                    </View>
                    {canCancel ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busyId === leave.id}
                        onPress={() => void cancel(leave)}
                        style={[
                          styles.cancelButton,
                          busyId === leave.id && styles.disabled,
                        ]}
                      >
                        <Text style={styles.cancelButtonText}>
                          {busyId === leave.id ? "Cancelling…" : "Cancel"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6fa" },
  container: {
    padding: 20,
    paddingBottom: 36,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    gap: 18,
  },
  nav: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navLink: { color: "#38539b", fontWeight: "800", fontSize: 13, padding: 8 },
  header: {
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#e9effb",
    borderWidth: 1,
    borderColor: "#dce5f5",
    gap: 8,
  },
  eyebrow: {
    color: "#4262a7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: "#17243d", fontSize: 30, fontWeight: "900" },
  subtitle: { color: "#586984", fontSize: 14, lineHeight: 21 },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5eaf2",
  },
  panelTitle: {
    color: "#17264b",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 2,
  },
  label: { color: "#405071", fontSize: 12, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: "#d7deeb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#17264b",
    fontSize: 15,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#3159b8",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#edf0f5",
    paddingVertical: 14,
  },
  leaveDetails: { gap: 4, flex: 1 },
  agentName: { color: "#17264b", fontSize: 14, fontWeight: "800" },
  dateRange: { color: "#64718a", fontSize: 13 },
  status: {
    color: "#9a5a12",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#e7b4b4",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cancelButtonText: { color: "#a33b3b", fontWeight: "800", fontSize: 12 },
  empty: { color: "#64718a", fontSize: 14, paddingVertical: 10 },
  error: { color: "#a33b3b", fontWeight: "700" },
  notice: { color: "#21845f", fontWeight: "700" },
});
