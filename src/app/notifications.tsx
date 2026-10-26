import { Link, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { fetchNotifications, markNotificationRead } from "@/api/tickets";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { Notification } from "@/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const readingIds = useRef(new Set<number>());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await fetchNotifications();
        if (active) {
          setNotifications(result.notifications);
          setUnreadCount(result.unreadCount);
          setError("");
        }
      } catch (reason: unknown) {
        if (active) setError(errorMessage(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const refresh = setInterval(() => void load(), 20_000);
    return () => {
      active = false;
      clearInterval(refresh);
    };
  }, []);

  const openNotification = async (item: Notification) => {
    if (item.readAt || readingIds.current.has(item.id)) return;
    readingIds.current.add(item.id);
    try {
      await markNotificationRead(item.id);
      setNotifications((items) =>
        items.map((entry) =>
          entry.id === item.id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      readingIds.current.delete(item.id);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setError("");
    try {
      await signOut();
      router.replace("/");
    } catch (reason: unknown) {
      setError(errorMessage(reason));
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
          <ScreenHeader title="Notifications">
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
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR SERVICE DESK</Text>
            <Text style={styles.heading}>Notifications</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryValue}>{unreadCount}</Text>
                <Text style={styles.summaryLabel}>Unread</Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryValue}>{notifications.length}</Text>
                <Text style={styles.summaryLabel}>Notifications</Text>
              </View>
            </View>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.list}>
            {loading ? (
              <Text style={styles.empty}>Loading notifications…</Text>
            ) : null}
            {!loading && notifications.length === 0 && !error ? (
              <Text style={styles.empty}>No notifications yet.</Text>
            ) : null}
            {notifications.map((item) => {
              const card = (
                <Pressable
                  onPress={() => void openNotification(item)}
                  style={StyleSheet.flatten([
                    styles.card,
                    !item.readAt && styles.cardUnread,
                  ])}
                >
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: item.readAt ? "#eef1f6" : "#eaf8f1" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.iconText,
                        { color: item.readAt ? "#71809b" : "#21845f" },
                      ]}
                    >
                      {item.ticketId ? "↗" : "◷"}
                    </Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text
                        style={[
                          styles.badge,
                          item.readAt ? styles.badgeRead : styles.badgeUnread,
                        ]}
                      >
                        {item.readAt ? "Read" : "New"}
                      </Text>
                    </View>
                    {item.ticketCode ? (
                      <Text style={styles.ticketCode}>{item.ticketCode}</Text>
                    ) : null}
                    <Text style={styles.cardText}>{item.body}</Text>
                    <Text style={styles.time}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
              );
              return item.ticketId ? (
                <Link
                  key={item.id}
                  href={`/ticket/${item.ticketId}` as any}
                  asChild
                >
                  {card}
                </Link>
              ) : (
                <View key={item.id}>{card}</View>
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
    padding: 24,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 1440,
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
  header: { paddingTop: 4 },
  eyebrow: {
    color: "#78828e",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  heading: { color: "#20252c", fontSize: 25, fontWeight: "800", marginTop: 6 },
  summaryRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  summaryPill: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ebef",
    borderRadius: 10,
    padding: 14,
  },
  summaryValue: { color: "#20252c", fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: "#78828e", fontSize: 11, marginTop: 4 },
  list: { marginTop: 16, gap: 8 },
  card: {
    backgroundColor: "#fff",  
    borderRadius: 10,
    padding: 15,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e8ebef",
  },
  cardUnread: { borderColor: "#b9ddca", backgroundColor: "#fcfffd" },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: { fontSize: 16, fontWeight: "900" },
  cardBody: { flex: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
    gap: 8,
  },
  cardTitle: { color: "#17264b", fontWeight: "800", fontSize: 14, flex: 1 },
  badge: {
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
    overflow: "hidden",
  },
  badgeRead: { color: "#68748a", backgroundColor: "#eff2f6" },
  badgeUnread: { color: "#21845f", backgroundColor: "#eaf8f1" },
  ticketCode: {
    color: "#38539b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardText: { color: "#59657c", fontSize: 12, lineHeight: 17 },
  time: { marginTop: 8, color: "#8490a4", fontSize: 10, fontWeight: "700" },
  empty: {
    color: "#71809b",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    fontSize: 12,
  },
  error: {
    color: "#b42318",
    backgroundColor: "#fff1f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
});
