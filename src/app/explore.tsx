import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage } from "@/api/client";
import { fetchTickets } from "@/api/tickets";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { Ticket } from "@/types";

const statusLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function countBy(tickets: Ticket[], getKey: (ticket: Ticket) => string) {
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    const key = getKey(ticket) || "Unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );
}

type CsvValue = string | number | null;

function csvCell(value: CsvValue) {
  let text = String(value ?? "");
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: CsvValue[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function MetricDot({ color }: { color: string }) {
  return <View style={[styles.metricDot, { backgroundColor: color }]} />;
}

function WorkflowDot({ color }: { color: string }) {
  return <View style={[styles.workflowDot, { backgroundColor: color }]} />;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const isAdmin = useAuth((state) => state.user?.role === "admin");
  const role = useAuth((state) => state.user?.role);
  const { width } = useWindowDimensions();
  const wideLayout = width >= 1000;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState("");
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<Date | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await fetchTickets({
          scope: isAdmin ? "all" : role === "agent" ? "department" : "raised",
          sort: "updated",
          page: 1,
          limit: 100,
        });
        if (active) {
          setTickets(result.data);
          setTicketTotal(result.total);
          setStatusCounts(result.counts);
          setSnapshotUpdatedAt(new Date());
          setSnapshotError("");
        }
      } catch (reason: unknown) {
        if (active) setSnapshotError(errorMessage(reason));
      } finally {
        if (active) setSnapshotLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdmin, role]);

  const activeTickets = Object.entries(statusCounts)
    .filter(([status]) => status !== "resolved")
    .reduce((total, [, count]) => total + count, 0);
  const resolvedTickets = statusCounts.resolved ?? 0;
  const departmentLoad = useMemo(
    () =>
      countBy(
        tickets.filter((ticket) => ticket.status !== "resolved"),
        (ticket) => ticket.department,
      ),
    [tickets],
  );
  const maxDepartmentLoad = Math.max(
    1,
    ...departmentLoad.map(([, count]) => count),
  );
  const priorityCounts = useMemo(
    () => countBy(tickets, (ticket) => ticket.priority),
    [tickets],
  );
  const workflow = useMemo(
    () =>
      Object.entries(statusCounts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, value]) => ({ label: statusLabel(label), value })),
    [statusCounts],
  );

  const exportReport = async () => {
    if (!isAdmin || exporting) return;
    if (Platform.OS !== "web") {
      Alert.alert(
        "Excel export",
        "Download the Excel report from the web app.",
      );
      return;
    }

    setExporting(true);
    setExportError("");
    setExportNotice("");
    try {
      const limit = 100;
      const firstPage = await fetchTickets({
        scope: "all",
        page: 1,
        limit,
        sort: "updated",
      });
      const tickets = [...firstPage.data];
      const pageCount = Math.ceil(firstPage.total / limit);

      for (let page = 2; page <= pageCount; page += 1) {
        const result = await fetchTickets({
          scope: "all",
          page,
          limit,
          sort: "updated",
        });
        tickets.push(...result.data);
      }

      if (tickets.length < firstPage.total) {
        throw new Error(
          `The report is incomplete: fetched ${tickets.length} of ${firstPage.total} tickets. Please try again.`,
        );
      }

      const rows: CsvValue[][] = [
        ["PSG Service Desk Report"],
        ["Generated at", new Date().toISOString()],
        ["Total tickets", tickets.length],
        [],
        ["Status summary"],
        ["Status", "Count"],
        ...countBy(tickets, (ticket) => ticket.status).map(([label, count]) => [
          statusLabel(label),
          count,
        ]),
        [],
        ["Priority summary"],
        ["Priority", "Count"],
        ...countBy(tickets, (ticket) => ticket.priority).map(
          ([label, count]) => [statusLabel(label), count],
        ),
        [],
        ["Department summary"],
        ["Department", "Ticket count"],
        ...countBy(tickets, (ticket) => ticket.department),
        [],
        ["Ticket details"],
        [
          "Ticket code",
          "Ticket ID",
          "Asset",
          "Description",
          "Department",
          "Category",
          "Service",
          "Priority",
          "Status",
          "Expected closing days",
          "Block",
          "Floor",
          "Room",
          "Requester",
          "Requester ID",
          "Assignee",
          "Assignee ID",
          "Parent ticket",
          "Created at",
          "Updated at",
          "Resolved at",
        ],
        ...tickets.map((ticket) => [
          ticket.code,
          ticket.id,
          ticket.asset,
          ticket.description ?? "",
          ticket.department,
          ticket.category,
          ticket.service,
          statusLabel(ticket.priority),
          statusLabel(ticket.status),
          ticket.expectedClosingDays ?? "",
          ticket.location.block ?? "",
          ticket.location.floor ?? "",
          ticket.location.room ?? "",
          ticket.createdBy.name,
          ticket.createdBy.empId,
          ticket.assignedTo?.name ?? "Unassigned",
          ticket.assignedTo?.empId ?? "",
          ticket.parentTicket?.code ?? "",
          ticket.createdAt,
          ticket.updatedAt,
          ticket.resolvedAt ?? "",
        ]),
      ];

      const blob = new Blob([toCsv(rows)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `service-desk-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice(
        `Excel-compatible report downloaded with ${tickets.length} tickets.`,
      );
    } catch (reason: unknown) {
      setExportError(errorMessage(reason));
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut();
      router.replace("/");
    } catch (error: unknown) {
      setLogoutError(errorMessage(error));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ProtectedRoute>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader title="Operations">
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
          {logoutError ? (
            <Text accessibilityRole="alert" style={styles.logoutError}>
              {logoutError}
            </Text>
          ) : null}

          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.eyebrow}>Operations</Text>
                <Text style={styles.heading}>Service pulse</Text>
              </View>
              {isAdmin ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={exporting}
                  onPress={() => void exportReport()}
                  style={[
                    styles.exportButton,
                    exporting && styles.logoutButtonDisabled,
                  ]}
                >
                  <Text style={styles.exportButtonText}>
                    {exporting ? "Preparing report…" : "Export to Excel"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {snapshotUpdatedAt
                  ? `Ticket data updated ${snapshotUpdatedAt.toLocaleTimeString()}`
                  : snapshotLoading
                    ? "Loading ticket data…"
                    : "Ticket data is available"}
              </Text>
            </View>

            <View style={styles.metricRow}>
              {[
                { label: "Open tickets", value: activeTickets, color: "#f3bb62" },
                { label: "Resolved", value: resolvedTickets, color: "#66d7ac" },
                { label: "Total tickets", value: ticketTotal, color: "#91adff" },
              ].map((item) => (
                <View
                  key={item.label}
                  style={styles.metricCard}
                  accessibilityRole="summary"
                >
                  <MetricDot color={item.color} />
                  <Text style={styles.metricValue}>
                    {snapshotLoading ? "—" : item.value}
                  </Text>
                  <Text style={styles.metricLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {exportError ? (
            <Text accessibilityRole="alert" style={styles.exportError}>
              Could not download report: {exportError}
            </Text>
          ) : null}
          {exportNotice ? (
            <Text style={styles.exportNotice}>{exportNotice}</Text>
          ) : null}
          {snapshotError ? (
            <Text accessibilityRole="alert" style={styles.exportError}>
              Could not load ticket insights: {snapshotError}
            </Text>
          ) : null}

          <View style={styles.content}>
            <View style={[styles.panel, wideLayout && styles.halfPanel]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Department workload</Text>
                <Text style={styles.panelChip}>Latest 100 tickets</Text>
              </View>

              {departmentLoad.map(([label, count]) => (
                <View
                  key={label}
                  style={styles.barRow}
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: maxDepartmentLoad,
                    now: count,
                  }}
                >
                  <Text style={styles.barLabel}>{label}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(4, (count / maxDepartmentLoad) * 100)}%`,
                          backgroundColor: "#4269c7",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>{count}</Text>
                </View>
              ))}
              {!snapshotLoading && departmentLoad.length === 0 ? (
                <Text style={styles.emptyState}>
                  No recent department workload to show.
                </Text>
              ) : null}
            </View>

            <View style={[styles.panel, wideLayout && styles.halfPanel]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Priority mix</Text>
                <Text style={styles.panelChipAlt}>Latest 100 tickets</Text>
              </View>

              <View style={styles.priorityRow}>
                {priorityCounts.map(([priority, count]) => (
                  <View
                    key={priority}
                    style={styles.priorityCard}
                    accessibilityRole="summary"
                  >
                    <Text style={styles.priorityValue}>{count}</Text>
                    <Text style={styles.priorityLabel}>
                      {statusLabel(priority)}
                    </Text>
                  </View>
                ))}
                {!snapshotLoading && priorityCounts.length === 0 ? (
                  <Text style={styles.emptyState}>
                    No recent tickets to summarize.
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.panel, styles.workflowPanel]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Ticket status</Text>
                <Text style={styles.panelChip}>All matching tickets</Text>
              </View>

              <View style={styles.workflowRow}>
                {workflow.map((item) => (
                  <View
                    key={item.label}
                    style={styles.workflowCard}
                    accessibilityRole="summary"
                  >
                    <WorkflowDot
                      color={
                        item.label === "Resolved"
                          ? "#2d9b73"
                          : item.label === "In Progress"
                            ? "#4269c7"
                            : "#d58a2c"
                      }
                    />
                    <Text style={styles.workflowValue}>{item.value}</Text>
                    <Text style={styles.workflowLabel}>{item.label}</Text>
                  </View>
                ))}
                {!snapshotLoading && workflow.length === 0 ? (
                  <Text style={styles.emptyState}>
                    No status data is available.
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f8fa" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 30,
    width: "100%",
    maxWidth: 1280,
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
    padding: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ebef",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  exportButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: "#fff",
    shadowColor: "#0c1b42",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  exportButtonText: { color: "#263f89", fontSize: 12, fontWeight: "800" },
  exportError: {
    color: "#b42318",
    backgroundColor: "#fff1f0",
    borderWidth: 1,
    borderColor: "#ffe1dd",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  exportNotice: {
    color: "#166b4d",
    backgroundColor: "#eaf8f1",
    borderWidth: 1,
    borderColor: "#d5f0e2",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
  },
  eyebrow: {
    color: "#78828e",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heading: {
    color: "#20252c",
    fontSize: 25,
    fontWeight: "700",
  },
  link: { color: "#24845d", fontWeight: "700" },
  liveRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#34d399",
  },
  liveText: {
    color: "#65717d",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
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
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  metricValue: {
    color: "#20252c",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  metricLabel: { color: "#78828e", fontSize: 11 },
  content: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 16,
  },
  panel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5eaf3",
    shadowOpacity: 0,
    elevation: 0,
  },
  halfPanel: { flexBasis: 420 },
  workflowPanel: { flexBasis: "100%" },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  panelTitle: {
    color: "#17264b",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  panelChip: {
    color: "#1f5cff",
    backgroundColor: "#edf3ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  panelChipAlt: {
    color: "#475569",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  barLabel: {
    width: 96,
    color: "#46536b",
    fontWeight: "700",
    fontSize: 12,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#edf1fa",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  barValue: {
    width: 42,
    color: "#111827",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "right",
  },
  priorityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  priorityCard: {
    flex: 1,
    flexBasis: "40%",
    minWidth: 90,
    backgroundColor: "#f4f6fa",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5eaf2",
  },
  priorityValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  priorityLabel: {
    fontSize: 12,
    color: "#4b5563",
    marginTop: 4,
    fontWeight: "700",
  },
  workflowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  workflowCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: "#f8faff",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e9effb",
  },
  workflowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 8,
  },
  workflowValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  workflowLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "700",
  },
  emptyState: {
    color: "#66738b",
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 12,
  },
});
