import { Link, useFocusEffect } from "expo-router";
import { createElement, type FormEvent, type ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  fetchActivity,
  fetchMeta,
  fetchNotifications,
  requestPasswordReset,
  fetchTickets,
  fetchWorkSessions,
  startWorkSession,
  stopWorkSession,
} from "@/api/tickets";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDuration } from "@/utils/format";
import type {
  ActivityItem,
  Meta,
  Priority,
  Scope,
  Status,
  Ticket,
  WorkSessionSummary,
} from "@/types";
import { BrandMark } from "@/components/brand-mark";
import { PieChart } from "@/components/ui/pie-chart";

function LoginForm({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
}) {
  if (Platform.OS === "web") {
    return createElement(
      "form",
      {
        onSubmit: (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void onSubmit();
        },
        style: { display: "flex", flexDirection: "column" },
      },
      children,
    );
  }

  return <View>{children}</View>;
}

const actions = [
  {
    icon: "+",
    label: "New ticket",
    accent: "#294aab",
    route: "/create-ticket",
  },
  { icon: "◷", label: "Work records", accent: "#6a5cff", route: "/records" },
  { icon: "⚡", label: "Alerts", accent: "#ff7a59", route: "/notifications" },
  { icon: "◉", label: "Operations", accent: "#31c48d", route: "/explore" },
  { icon: "🧾", label: "Reports", accent: "#6dd3ff", route: "/explore" },
];

const defaultPriorityColors: Record<string, string> = {
  low: "#5ec8a5",
  medium: "#ffc857",
  high: "#ff7a59",
  critical: "#ff5d73",
};

const priorityColor = (priority: string) =>
  defaultPriorityColors[priority] ?? "#718096";
const ticketStatusColor = (status: string) =>
  status === "resolved"
    ? "#31a77a"
    : status === "in_progress"
      ? "#315bd6"
      : status === "open"
        ? "#c47b17"
        : "#718096";
const statusLabel = (status: string) =>
  status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const activityTone = (action: string) =>
  action === "status"
    ? "#5d7cff"
    : action === "assigned"
      ? "#34d399"
      : "#ffb454";

const scopeLabels: Record<Scope, string> = {
  all: "All tickets",
  department: "My department",
  assigned: "Assigned or linked to me",
  raised: "Raised by me",
};

function LoginScreen() {
  const { signIn } = useAuth();
  const hydrate = useAuth((state) => state.hydrate);
  const sessionError = useAuth((state) => state.sessionError);
  const { width } = useWindowDimensions();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [heroOpacity] = useState(() => new Animated.Value(0));
  const [heroOffset] = useState(() => new Animated.Value(24));
  const [orbit] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === "web") return;
    const showSubscription = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: false,
      }),
      Animated.spring(heroOffset, {
        toValue: 0,
        damping: 18,
        stiffness: 90,
        useNativeDriver: false,
      }),
    ]).start();
    const orbitAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(orbit, {
          toValue: 1,
          duration: 3400,
          useNativeDriver: false,
        }),
        Animated.timing(orbit, {
          toValue: 0,
          duration: 3400,
          useNativeDriver: false,
        }),
      ]),
    );
    orbitAnimation.start();
    return () => orbitAnimation.stop();
  }, [heroOffset, heroOpacity, orbit]);

  const onLogin = async () => {
    try {
      setLoading(true);
      setError("");
      setNotice("");
      await signIn(empId, password);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    if (!empId.trim()) {
      setError("Enter your employee ID to request a password reset.");
      return;
    }
    try {
      setRequestingReset(true);
      setError("");
      setNotice("");
      const result = await requestPasswordReset(empId.trim());
      setNotice(result.message);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setRequestingReset(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginSafeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.loginContainer,
            width >= 900 && styles.loginContainerWide,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View
            style={[styles.loginFrame, width >= 900 && styles.loginFrameWide]}
          >
            <Animated.View
              style={[
                styles.loginHero,
                width < 900 && styles.loginHeroCompact,
                width < 900 &&
                  keyboardVisible &&
                  styles.loginHeroKeyboardHidden,
                {
                  opacity: heroOpacity,
                  transform: [{ translateY: heroOffset }],
                },
              ]}
            >
              <View style={styles.loginHeroTop}>
                <BrandMark inverse />
                <View style={styles.secureTag}>
                  <View style={styles.secureDot} />
                  <Text style={styles.secureText}>CAMPUS SUPPORT</Text>
                </View>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.loginBadge}>PSG • SERVICE DESK</Text>
                <Text style={styles.loginTitle}>
                  Campus support,{"\n"}made simple.
                </Text>
                <Text style={styles.loginSubtitle}>
                  One calm place to raise a request, follow every update, and
                  keep campus services moving.
                </Text>
                <View style={styles.heroFeatures}>
                  <HeroFeature icon="✓" title="Clear updates" />
                  <HeroFeature icon="↗" title="Right team, faster" />
                  <HeroFeature icon="◷" title="Always in view" />
                </View>
              </View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.orbitOuter,
                  {
                    opacity: orbit.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 0.85],
                    }),
                    transform: [
                      {
                        scale: orbit.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.92, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.orbitInner} />
              </Animated.View>
              <Text style={styles.heroFootnote}>
                A smarter way to care for your campus.
              </Text>
            </Animated.View>

            <View
              style={[
                styles.loginSide,
                width < 900 && styles.loginSideCompact,
                width < 900 && keyboardVisible && styles.loginSideKeyboardOpen,
              ]}
            >
              <View style={styles.mobileBrand}>
                <BrandMark compact />
              </View>
              <View style={styles.loginFormWrap}>
                <Text style={styles.formEyebrow}>WELCOME BACK</Text>
                <Text style={styles.formTitle}>Sign in to continue</Text>
                <Text style={styles.formIntro}>
                  Use your PSG employee account to open your workspace.
                </Text>
                {sessionError ? (
                  <View style={styles.sessionWarning}>
                    <Text accessibilityRole="alert" style={styles.errorText}>
                      {sessionError}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void hydrate()}
                      style={styles.sessionRetry}
                    >
                      <Text style={styles.sessionRetryText}>
                        Retry saved session
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <LoginForm onSubmit={onLogin}>
                  <Text style={styles.formLabel}>Employee ID</Text>
                  <TextInput
                    value={empId}
                    onChangeText={(value) => {
                      setEmpId(value);
                      setError("");
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="username"
                    accessibilityLabel="Employee ID"
                    style={styles.input}
                    placeholder="e.g. C6602"
                    placeholderTextColor="#9aa5b8"
                    returnKeyType="next"
                  />

                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.formLabel}>Password</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onForgotPassword()}
                      disabled={requestingReset}
                      hitSlop={8}
                    >
                      <Text style={styles.forgotPassword}>
                        {requestingReset ? "Requesting…" : "Forgot password?"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        setError("");
                      }}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                      textContentType="password"
                      accessibilityLabel="Password"
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Enter your password"
                      placeholderTextColor="#9aa5b8"
                      returnKeyType="done"
                      onSubmitEditing={() => void onLogin()}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                      accessibilityState={{ selected: showPassword }}
                      onPress={() => setShowPassword((visible) => !visible)}
                      style={styles.passwordVisibilityButton}
                      hitSlop={8}
                    >
                      <Text style={styles.passwordVisibilityText}>
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>

                  {error ? (
                    <Text accessibilityRole="alert" style={styles.errorText}>
                      {error}
                    </Text>
                  ) : null}
                  {notice ? (
                    <Text accessibilityRole="alert" style={styles.noticeText}>
                      {notice}
                    </Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    style={[
                      styles.loginButton,
                      loading && styles.loginButtonDisabled,
                    ]}
                    onPress={onLogin}
                    disabled={loading}
                  >
                    <Text style={styles.loginButtonText}>
                      {loading ? "Signing you in…" : "Sign in securely"}
                    </Text>
                    {!loading ? (
                      <Text style={styles.loginButtonArrow}>→</Text>
                    ) : null}
                  </Pressable>
                </LoginForm>

                <View style={styles.privacyNote}>
                  <Text style={styles.privacyIcon}>◇</Text>
                  <Text style={styles.privacyText}>
                    Your account is protected. Never share your password.
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.loginCopyright,
                  keyboardVisible && styles.loginCopyrightKeyboardOpen,
                ]}
              >
                PSG Service Desk · Campus operations
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HeroFeature({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.heroFeature}>
      <Text style={styles.heroFeatureIcon}>{icon}</Text>
      <Text style={styles.heroFeatureText}>{title}</Text>
    </View>
  );
}

function TimeTrackingSection() {
  const [summary, setSummary] = useState<WorkSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      setSummary(await fetchWorkSessions());
      setNow(Date.now());
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
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  const activeSession = summary?.activeSession ?? null;
  const elapsedSeconds = activeSession
    ? Math.max(
        0,
        Math.floor((now - new Date(activeSession.startedAt).getTime()) / 1000),
      )
    : 0;

  const handleToggle = async () => {
    if (!summary || updating) return;
    setUpdating(true);
    setError("");
    try {
      if (activeSession) {
        await stopWorkSession(activeSession.id);
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

  return (
    <View style={styles.section}>
      <View style={styles.moduleHeader}>
        <Text style={styles.sectionTitle}>Time tracking</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            activeSession ? "Stop work session" : "Start work session"
          }
          disabled={loading || updating || !summary}
          onPress={() => {
            void handleToggle();
          }}
          style={[
            styles.trackButton,
            activeSession && styles.trackButtonActive,
            (loading || updating || !summary) && styles.trackButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.trackButtonText,
              activeSession && styles.trackButtonTextActive,
            ]}
          >
            {loading
              ? "Loading…"
              : updating
                ? activeSession
                  ? "Stopping…"
                  : "Starting…"
                : activeSession
                  ? "Stop"
                  : "Start"}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>Current session</Text>
        <Text style={styles.timerValue}>{formatDuration(elapsedSeconds)}</Text>
        <Text style={styles.timerSub}>
          {activeSession
            ? "This session is saved in Work records."
            : "Start a session to save time in Work records."}
        </Text>
      </View>
    </View>
  );
}

function DashboardScreen() {
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const dashboardScroll = useRef<ScrollView>(null);
  const ticketQueueOffset = useRef(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [statusGroup, setStatusGroup] = useState<"open" | "resolved" | null>(
    null,
  );
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const defaultScope: Scope =
    user?.role === "admin"
      ? "all"
      : user?.role === "agent"
        ? "assigned"
        : "raised";
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [departments, setDepartments] = useState<Meta["departments"]>([]);
  const [catalogMeta, setCatalogMeta] = useState<Meta | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [linkedTickets, setLinkedTickets] = useState<Ticket[]>([]);
  const [linkedTicketsTotal, setLinkedTicketsTotal] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityError, setActivityError] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});
  const [loadedRequest, setLoadedRequest] = useState("");
  const [loadError, setLoadError] = useState("");
  const [refreshSequence, setRefreshSequence] = useState(0);
  const debouncedSearch = useDebounce(search);
  const requestKey = `${scope}|${statusFilter}|${statusGroup}|${linkedOnly}|${priorityFilter}|${departmentFilter}|${debouncedSearch}|${page}|${refreshSequence}`;
  const loadingTickets = loadedRequest !== requestKey;
  const availableScopes: Scope[] = useMemo(
    () =>
      user?.role === "admin"
        ? ["all", "department", "assigned", "raised"]
        : user?.role === "agent"
          ? ["assigned", "department", "raised"]
          : ["raised"],
    [user?.role],
  );

  useFocusEffect(
    useCallback(() => {
      const refresh = setInterval(
        () => setRefreshSequence((sequence) => sequence + 1),
        30_000,
      );
      return () => clearInterval(refresh);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchMeta()
        .then((metaResult) => {
          if (active) {
            setDepartments(metaResult.departments);
            setCatalogMeta(metaResult);
          }
        })
        .catch((error: unknown) => {
          if (active) setLoadError(errorMessage(error));
        });
      return () => {
        active = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const ticketFilters = {
        scope,
        search: debouncedSearch || undefined,
        priority: priorityFilter ?? undefined,
        status: statusGroup ? undefined : (statusFilter ?? undefined),
        statusGroup: statusFilter ? undefined : (statusGroup ?? undefined),
        department: departmentFilter ?? undefined,
        linkedOnly: linkedOnly || undefined,
        sort: "updated" as const,
        limit: 100,
      };
      const linkedTicketFilters = {
        scope,
        search: debouncedSearch || undefined,
        priority: priorityFilter ?? undefined,
        department: departmentFilter ?? undefined,
        sort: "updated" as const,
        limit: 100,
        linkedOnly: true,
      };
      Promise.all([
        fetchTickets({ ...ticketFilters, page }),
        fetchTickets({ ...linkedTicketFilters, page: 1 }),
      ])
        .then(([ticketList, linkedTicketList]) => {
          if (!active) return;
          setTickets(ticketList.data);
          setLinkedTickets(linkedTicketList.data);
          setLinkedTicketsTotal(linkedTicketList.total);
          setTotalTickets(ticketList.total);
          setTicketCounts({
            open: 0,
            in_progress: 0,
            resolved: 0,
            ...ticketList.counts,
          });
          setLoadError("");
        })
        .catch((error: unknown) => {
          if (active) setLoadError(errorMessage(error));
        })
        .finally(() => {
          if (active) setLoadedRequest(requestKey);
        });

      return () => {
        active = false;
      };
    }, [
      debouncedSearch,
      departmentFilter,
      page,
      requestKey,
      linkedOnly,
      scope,
      statusGroup,
      statusFilter,
      priorityFilter,
    ]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refreshActivity = () => {
        fetchActivity({ scope })
          .then((activityList) => {
            if (!active) return;
            setActivities(activityList);
            setActivityError("");
          })
          .catch((error: unknown) => {
            if (active) setActivityError(errorMessage(error));
          });
      };
      refreshActivity();
      const interval = setInterval(refreshActivity, 30_000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [scope]),
  );

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !term ||
        String(ticket.id).includes(term) ||
        ticket.code.toLowerCase().includes(term) ||
        ticket.asset.toLowerCase().includes(term) ||
        ticket.department.toLowerCase().includes(term) ||
        ticket.service.toLowerCase().includes(term) ||
        ticket.category.toLowerCase().includes(term) ||
        Object.values(ticket.location).some((value) =>
          value?.toLowerCase().includes(term),
        ) ||
        (ticket.description || "").toLowerCase().includes(term);

      return matchesSearch;
    });
  }, [search, tickets]);
  const filteredLinkedTickets = useMemo(
    () =>
      linkedTickets.filter((ticket) => {
        const term = search.trim().toLowerCase();
        return (
          !term ||
          String(ticket.id).includes(term) ||
          ticket.code.toLowerCase().includes(term) ||
          ticket.asset.toLowerCase().includes(term) ||
          ticket.department.toLowerCase().includes(term) ||
          ticket.service.toLowerCase().includes(term) ||
          ticket.category.toLowerCase().includes(term) ||
          Object.values(ticket.location).some((value) =>
            value?.toLowerCase().includes(term),
          ) ||
          (ticket.description || "").toLowerCase().includes(term)
        );
      }),
    [linkedTickets, search],
  );

  const handleSummaryPress = useCallback(
    (label: "Open tickets" | "Resolved" | "Linked tickets") => {
      setSearch("");
      setPriorityFilter(null);
      setDepartmentFilter(null);
      setStatusFilter(null);
      setPage(1);
      if (label === "Linked tickets") {
        setLinkedOnly(true);
        setStatusGroup(null);
      } else {
        setLinkedOnly(false);
        setStatusGroup(label === "Resolved" ? "resolved" : "open");
      }
      dashboardScroll.current?.scrollTo({
        y: ticketQueueOffset.current,
        animated: true,
      });
    },
    [],
  );
  const stats: {
    label: "Open tickets" | "Resolved" | "Linked tickets";
    value: string;
    tone: string;
    selected: boolean;
  }[] = [
    {
      label: "Open tickets",
      value: String(
        Object.entries(ticketCounts)
          .filter(([status]) => status !== "resolved")
          .reduce((total, [, count]) => total + count, 0),
      ),
      tone: "#7c9cff",
      selected: statusGroup === "open" && !linkedOnly,
    },
    {
      label: "Resolved",
      value: String(ticketCounts.resolved ?? 0),
      tone: "#ffb454",
      selected: statusGroup === "resolved" && !linkedOnly,
    },
    {
      label: "Linked tickets",
      value: String(linkedTicketsTotal),
      tone: "#41d3a4",
      selected: linkedOnly,
    },
  ];
  const statusChartSlices = useMemo(() => {
    const statuses = [
      ...new Set([
        ...(catalogMeta?.statuses ?? []),
        ...Object.keys(ticketCounts),
      ]),
    ];
    return statuses.map((status, index) => ({
      label: statusLabel(status),
      value: ticketCounts[status] ?? 0,
      color: [
        "#315bd6",
        "#31a77a",
        "#ff9b45",
        "#8b5cf6",
        "#e25579",
        "#0891b2",
        "#65758b",
      ][index % 7],
      status,
    }));
  }, [catalogMeta?.statuses, ticketCounts]);

  const recentActivity = useMemo(() => activities.slice(0, 3), [activities]);
  const visibleActions = useMemo(
    () =>
      user?.role === "admin"
        ? [
            ...actions,
            {
              icon: "◷",
              label: "Resolver leave",
              accent: "#b45309",
              route: "/leave",
            },
            {
              icon: "⚙",
              label: "Manage people",
              accent: "#334d93",
              route: "/admin",
            },
          ]
        : user?.role === "agent"
          ? [
              ...actions,
              {
                icon: "◷",
                label: "Resolver leave",
                accent: "#b45309",
                route: "/leave",
              },
            ]
          : actions,
    [user?.role],
  );
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalTickets / 100)),
    [totalTickets],
  );
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const handleResetPage = () => setPage(1);
  const handleScopeChange = (nextScope: Scope) => {
    setScope(nextScope);
    handleResetPage();
  };
  const handleStatusChange = (nextStatus: Status | null) => {
    setStatusFilter(nextStatus);
    setStatusGroup(null);
    setLinkedOnly(false);
    handleResetPage();
  };
  const handlePriorityChange = (nextPriority: Priority | null) => {
    setPriorityFilter(nextPriority);
    handleResetPage();
  };
  const handleDepartmentChange = (nextDepartment: number | null) => {
    setDepartmentFilter(nextDepartment);
    handleResetPage();
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refreshNotifications = () => {
        fetchNotifications()
          .then((result) => {
            if (active) {
              setUnreadNotificationCount(result.unreadCount);
              setNotificationError("");
            }
          })
          .catch((reason: unknown) => {
            if (active) setNotificationError(errorMessage(reason));
          });
      };
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 20_000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={dashboardScroll}
        contentContainerStyle={[
          styles.container,
          width >= 1000 && styles.containerWide,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardNav}>
        {Platform.OS === "web" && width >= 1080 ? (
          <Text style={styles.dashboardTitle}>Ticket</Text>
        ) : (
          <BrandMark compact />
        )}
        <View style={styles.dashboardNavRight}>
            <Text style={styles.roleTag}>{user?.role || "user"} workspace</Text>
            <Link href="/notifications" asChild>
              <Pressable style={styles.alertButton}>
                <Text style={styles.alertButtonText}>
                  Alerts
                  {unreadNotificationCount
                    ? ` · ${unreadNotificationCount}`
                    : ""}
                </Text>
              </Pressable>
            </Link>
            <Pressable
              style={styles.avatar}
              onPress={() =>
                signOut().catch(() => Alert.alert("Sign out failed"))
              }
            >
              <Text style={styles.avatarText}>
                {(user?.name || "AP").slice(0, 2).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.hero, width >= 1000 && styles.heroWide]}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.eyebrow}>Good afternoon</Text>
              <Text style={styles.title}>
                Welcome back, {user?.name?.split(" ")[0] || "Operator"}
              </Text>
            </View>
            <Text
              style={[
                styles.heroWelcome,
                width < 600 && styles.heroWelcomeCompact,
              ]}
            >
              Your campus operations at a glance
            </Text>
          </View>

          <View style={styles.summaryRow}>
            {stats.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: item.selected }}
                onPress={() => handleSummaryPress(item.label)}
                style={[
                  styles.summaryCard,
                  item.selected && styles.summaryCardSelected,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: item.tone }]} />
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {notificationError ? (
          <Text style={styles.errorText}>
            Could not refresh notifications: {notificationError}
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ticket status distribution</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartGraphic}>
              <PieChart slices={statusChartSlices} />
              <Text style={styles.chartTotal}>
                {Object.values(ticketCounts).reduce(
                  (total, count) => total + count,
                  0,
                )}
              </Text>
              <Text style={styles.chartCaption}>tickets</Text>
            </View>
            <View style={styles.chartLegend}>
              {statusChartSlices.map((slice) => (
                <Pressable
                  key={slice.status}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter tickets by ${slice.label}: ${slice.value}`}
                  accessibilityState={{
                    selected: statusFilter === slice.status,
                  }}
                  onPress={() => handleStatusChange(slice.status)}
                  style={styles.chartLegendRow}
                >
                  <View
                    style={[
                      styles.chartLegendDot,
                      { backgroundColor: slice.color },
                    ]}
                  />
                  <Text style={styles.chartLegendLabel}>{slice.label}</Text>
                  <Text style={styles.chartLegendValue}>{slice.value}</Text>
                </Pressable>
              ))}
              {statusChartSlices.length === 0 ? (
                <Text style={styles.chartEmpty}>
                  Status options will appear here when available.
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.chartHelp}>
            Select a status to filter the ticket queue. Counts reflect your
            selected role, queue, and department filters.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionsGrid}>
            {visibleActions.map((action) => (
              <Link key={action.label} href={action.route as any} asChild>
                <Pressable style={styles.actionCard}>
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: `${action.accent}22` },
                    ]}
                  >
                    <Text style={{ color: action.accent, fontSize: 18 }}>
                      {action.icon}
                    </Text>
                  </View>
                  <Text style={styles.actionLabel}>
                    {action.label === "Alerts" && unreadNotificationCount > 0
                      ? `${action.label} (${unreadNotificationCount})`
                      : action.label}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        <TimeTrackingSection />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {activityError ? (
            <Text style={styles.errorText}>
              Could not load activity: {activityError}
            </Text>
          ) : null}
          <View style={styles.notifyList}>
            {activities.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.notifyItem}>
                <View
                  style={[
                    styles.notifyDot,
                    { backgroundColor: activityTone(item.action) },
                  ]}
                />
                <View style={styles.notifyBody}>
                  <Text style={styles.notifyTitle}>
                    {item.detail || item.action}
                  </Text>
                  <Text style={styles.notifyTime}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
            {activities.length === 0 ? (
              <Text style={styles.emptyText}>No new notifications.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ticket lifecycle</Text>
          <View style={styles.timelineCard}>
            {recentActivity.map((item, index) => (
              <View key={item.id} style={styles.timelineRow}>
                <View style={styles.timelineTrack}>
                  <View
                    style={[
                      styles.timelineDot,
                      index === 0 && styles.timelineDotActive,
                    ]}
                  />
                  {index < recentActivity.length - 1 ? (
                    <View style={styles.timelineLine} />
                  ) : null}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineLabel}>{item.action}</Text>
                  <Text style={styles.timelineDetail}>
                    {item.detail || item.ticketCode}
                  </Text>
                  <Text style={styles.timelineTime}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
            {recentActivity.length === 0 ? (
              <Text style={styles.emptyText}>No recent ticket activity.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Linked department tickets ({linkedTicketsTotal})
            </Text>
            <Text style={styles.linkedSectionHint}>
              Live from your queue filters
            </Text>
          </View>
          <View style={styles.linkedTicketList}>
            {filteredLinkedTickets.slice(0, 5).map((ticket) => (
              <Link
                key={ticket.id}
                href={`/ticket/${ticket.id}` as any}
                asChild
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View linked ticket ${ticket.code}, linked from ${ticket.parentTicket?.code}`}
                  style={styles.linkedTicketCard}
                >
                  <View style={styles.linkedTicketTopRow}>
                    <View style={styles.linkedTicketCopy}>
                      <Text style={styles.linkedTicketCode}>{ticket.code}</Text>
                      <Text style={styles.linkedTicketAsset}>
                        {ticket.asset}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.linkedTicketStatus,
                        {
                          color: ticketStatusColor(ticket.status),
                          backgroundColor: `${ticketStatusColor(ticket.status)}22`,
                        },
                      ]}
                    >
                      {statusLabel(ticket.status)}
                    </Text>
                  </View>
                  <Text style={styles.linkedTicketMeta}>
                    {ticket.department} · Assigned to{" "}
                    {ticket.assignedTo?.name || "Unassigned"}
                  </Text>
                  {ticket.resolverOnLeave ? (
                    <Text style={styles.resolverLeaveNote}>
                      {ticket.resolverOnLeave.name} is on leave ·{" "}
                      {ticket.assignedTo
                        ? `${ticket.assignedTo.name} is covering`
                        : "awaiting a covering resolver"}
                    </Text>
                  ) : null}
                  <Text style={styles.linkedTicketParent}>
                    Linked from {ticket.parentTicket?.code} · Ticket ID{" "}
                    {ticket.id}
                  </Text>
                  <Text style={styles.ticketDetailsLink}>
                    View linked ticket and history →
                  </Text>
                </Pressable>
              </Link>
            ))}
            {loadingTickets ? (
              <Text style={styles.emptyText}>Refreshing linked tickets…</Text>
            ) : null}
            {!loadingTickets && linkedTicketsTotal === 0 ? (
              <Text style={styles.emptyText}>
                No linked department tickets in this queue.
              </Text>
            ) : null}
            {!loadingTickets &&
            filteredLinkedTickets.length === 0 &&
            linkedTicketsTotal > 0 ? (
              <Text style={styles.emptyText}>
                No linked tickets match the current search.
              </Text>
            ) : null}
            {!loadingTickets && filteredLinkedTickets.length > 5 ? (
              <Text style={styles.emptyText}>
                Showing the 5 most recently updated linked tickets. Search by
                ticket ID or code in Live queue to find another linked ticket.
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(event) => {
            ticketQueueOffset.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Live queue</Text>
              <Text style={styles.queueHint}>
                Select a ticket to view its complete details.
              </Text>
            </View>
            <Link href="/explore" asChild>
              <Pressable>
                <Text style={styles.linkText}>View reports</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={handleSearchChange}
              placeholder="Search by ticket ID, code, asset or location"
              placeholderTextColor="#8B93A7"
              style={styles.searchInput}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {availableScopes.map((item) => (
              <Pressable
                key={item}
                onPress={() => handleScopeChange(item)}
                style={[
                  styles.filterPill,
                  scope === item && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    scope === item && styles.filterTextActive,
                  ]}
                >
                  {scopeLabels[item]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {(
              [null, ...(catalogMeta?.statuses ?? [])] as (Status | null)[]
            ).map((item) => (
              <Pressable
                key={item ?? "all-statuses"}
                onPress={() => handleStatusChange(item)}
                style={[
                  styles.filterPill,
                  statusFilter === item && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === item && styles.filterTextActive,
                  ]}
                >
                  {item === null ? "All" : statusLabel(item)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {(
              [null, ...(catalogMeta?.priorities ?? [])] as (Priority | null)[]
            ).map((item) => (
              <Pressable
                key={item ?? "all-priorities"}
                onPress={() => handlePriorityChange(item)}
                style={[
                  styles.filterPill,
                  priorityFilter === item && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    priorityFilter === item && styles.filterTextActive,
                  ]}
                >
                  {item === null ? "Any priority" : statusLabel(item)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {departments.length > 0 && user?.role !== "user" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              <Pressable
                onPress={() => handleDepartmentChange(null)}
                style={[
                  styles.filterPill,
                  departmentFilter === null && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    departmentFilter === null && styles.filterTextActive,
                  ]}
                >
                  Any department
                </Text>
              </Pressable>
              {departments.map((department) => (
                <Pressable
                  key={department.id}
                  onPress={() => handleDepartmentChange(department.id)}
                  style={[
                    styles.filterPill,
                    departmentFilter === department.id &&
                      styles.filterPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      departmentFilter === department.id &&
                        styles.filterTextActive,
                    ]}
                  >
                    {department.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View
            style={[
              styles.ticketList,
              width >= 1080 && styles.ticketListWide,
            ]}
          >
            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : null}
            {loadingTickets ? (
              <Text style={styles.emptyText}>Loading tickets…</Text>
            ) : null}
            {!loadingTickets && !loadError && filteredTickets.length === 0 ? (
              <Text style={styles.emptyText}>
                No tickets match these filters.
              </Text>
            ) : null}
            {filteredTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/ticket/${ticket.id}` as any}
                asChild
              >
                <Pressable
                  style={StyleSheet.flatten([
                    styles.ticketCard,
                    width >= 1080 && styles.ticketCardWide,
                  ])}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${ticket.code}, ${ticket.asset}`}
                >
                  <View
                    style={[
                      styles.ticketRow,
                      width >= 1080 && styles.ticketRowWide,
                    ]}
                  >
                    <View
                      style={[
                        styles.ticketTopRow,
                        width >= 1080 && styles.ticketTopRowWide,
                      ]}
                    >
                      <View style={styles.ticketCopy}>
                        <Text style={styles.ticketId}>{ticket.code}</Text>
                        <Text style={styles.ticketTitle}>{ticket.asset}</Text>
                      </View>
                      <View
                        style={[
                          styles.priorityBadge,
                          {
                            backgroundColor: `${priorityColor(ticket.priority)}22`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            { color: priorityColor(ticket.priority) },
                          ]}
                        >
                          {ticket.priority}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.ticketMetaRow,
                        width >= 1080 && styles.ticketMetaRowWide,
                      ]}
                    >
                      <Text style={styles.ticketMeta}>{ticket.department}</Text>
                      <Text style={styles.separator}>•</Text>
                      <Text style={styles.ticketMeta}>
                        {ticket.assignedTo?.name || "Unassigned"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.progressWrap,
                        width >= 1080 && styles.progressWrapWide,
                      ]}
                    >
                      <View style={styles.statusBar}>
                        <View
                          style={[
                            styles.statusFill,
                            {
                              width:
                                ticket.status === "resolved"
                                  ? "100%"
                                  : ticket.status === "in_progress"
                                    ? "62%"
                                    : "28%",
                              backgroundColor: priorityColor(ticket.priority),
                            },
                          ]}
                        />
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: `${priorityColor(ticket.priority)}22`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: priorityColor(ticket.priority) },
                          ]}
                        >
                          {statusLabel(ticket.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {ticket.resolverOnLeave ? (
                    <Text style={styles.resolverLeaveNote}>
                      {ticket.resolverOnLeave.name} is on leave ·{" "}
                      {ticket.assignedTo
                        ? `${ticket.assignedTo.name} is covering`
                        : "awaiting a covering resolver"}
                    </Text>
                  ) : null}
                  {ticket.parentTicket ? (
                    <Text style={styles.linkedTicketParent}>
                      Linked from {ticket.parentTicket.code} · ID {ticket.id}
                    </Text>
                  ) : null}

                  <Text
                    style={[
                      styles.ticketDetailsLink,
                      width >= 1080 && styles.ticketDetailsLinkWide,
                    ]}
                  >
                    Open full ticket details →
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
          <View style={styles.pagination}>
            <Text style={styles.paginationText}>
              {totalTickets === 0
                ? "No tickets"
                : `Page ${page} of ${totalPages} · ${totalTickets} tickets`}
            </Text>
            <View style={styles.paginationActions}>
              <Pressable
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={[
                  styles.pageButton,
                  page <= 1 && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageButtonText}>Previous</Text>
              </Pressable>
              <Pressable
                disabled={page >= totalPages}
                onPress={() => setPage((current) => current + 1)}
                style={[
                  styles.pageButton,
                  page >= totalPages && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageButtonText}>Next</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <Text style={styles.loadingText}>Loading Service Desk…</Text>
      </SafeAreaView>
    );
  }

  return user ? <DashboardScreen /> : <LoginScreen />;
}

const styles = StyleSheet.create({
  loadingSafeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f6fa",
  },
  loadingText: { color: "#17264b", fontWeight: "800", fontSize: 20 },
  loginSafeArea: { flex: 1, backgroundColor: "#f4f6fa" },
  keyboardAvoiding: { flex: 1 },
  loginContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 28,
    justifyContent: "center",
  },
  loginContainerWide: {
    paddingVertical: 32,
    paddingHorizontal: 42,
    alignItems: "center",
  },
  loginFrame: { flex: 1, gap: 16 },
  loginFrameWide: {
    width: "100%",
    maxWidth: 1240,
    minHeight: 650,
    maxHeight: 820,
    flexDirection: "row",
    gap: 0,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#18336f",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    elevation: 8,
  },
  loginHero: {
    width: "56%",
    minHeight: 480,
    borderRadius: 30,
    padding: 26,
    overflow: "hidden",
    backgroundColor: "#172b5c",
    justifyContent: "space-between",
  },
  loginHeroCompact: { width: "100%", minHeight: 380, borderRadius: 26 },
  loginHeroKeyboardHidden: { display: "none" },
  loginHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  secureTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  secureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#62e6b2",
  },
  secureText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroCopy: { maxWidth: 540, marginTop: 48, marginBottom: 36, zIndex: 2 },
  loginBadge: {
    color: "#aebfff",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 14,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 42,
    lineHeight: 49,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  loginSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: 440,
  },
  heroFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 28,
  },
  heroFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroFeatureIcon: { color: "#8bf0ca", fontSize: 12, fontWeight: "900" },
  heroFeatureText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 10,
    fontWeight: "700",
  },
  orbitOuter: {
    position: "absolute",
    width: 400,
    height: 400,
    borderWidth: 1,
    borderColor: "rgba(160,188,255,0.15)",
    borderRadius: 200,
    right: -150,
    bottom: -130,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitInner: {
    width: 260,
    height: 260,
    borderWidth: 1,
    borderColor: "rgba(160,188,255,0.16)",
    borderRadius: 130,
    backgroundColor: "rgba(87,122,218,0.12)",
  },
  heroFootnote: { color: "rgba(255,255,255,0.54)", fontSize: 11, zIndex: 2 },
  loginSide: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 54,
    paddingVertical: 36,
    backgroundColor: "#fff",
  },
  loginSideCompact: {
    padding: 23,
    marginTop: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#e8edf5",
  },
  loginSideKeyboardOpen: { padding: 16 },
  mobileBrand: { display: "none", marginBottom: 28 },
  loginFormWrap: { width: "100%", maxWidth: 390, alignSelf: "center" },
  formEyebrow: {
    color: "#576fb0",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  formTitle: {
    color: "#17264b",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  formIntro: {
    color: "#78849b",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 25,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#34415e",
    marginBottom: 8,
    marginTop: 13,
  },
  input: {
    backgroundColor: "#fafbfe",
    borderWidth: 1,
    borderColor: "#e1e6f0",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#17264b",
    fontSize: 14,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotPassword: {
    color: "#38539b",
    fontSize: 11,
    fontWeight: "800",
    paddingVertical: 10,
  },
  passwordInputWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e6f0",
    borderRadius: 13,
    backgroundColor: "#fafbfe",
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  passwordVisibilityButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  passwordVisibilityText: {
    color: "#38539b",
    fontSize: 12,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 12,
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
  },
  sessionWarning: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff1f0",
    borderWidth: 1,
    borderColor: "#ffe1dd",
  },
  sessionRetry: {
    alignSelf: "flex-start",
    paddingTop: 8,
    paddingBottom: 2,
  },
  sessionRetryText: {
    color: "#38539b",
    fontSize: 11,
    fontWeight: "800",
  },
  noticeText: {
    marginTop: 12,
    color: "#166b4d",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  loginButton: {
    marginTop: 22,
    backgroundColor: "#294aab",
    borderRadius: 13,
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  loginButtonArrow: { color: "#fff", fontSize: 18, fontWeight: "700" },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  privacyIcon: { color: "#5972b5", fontSize: 16, fontWeight: "900" },
  privacyText: { color: "#8791a5", fontSize: 10, flexShrink: 1 },
  loginCopyright: {
    color: "#a2aabc",
    fontSize: 10,
    textAlign: "center",
    marginTop: 34,
  },
  loginCopyrightKeyboardOpen: { marginTop: 12 },
  safeArea: { flex: 1, backgroundColor: "#f4f6fa" },
  container: { paddingHorizontal: 18, paddingBottom: 32 },
  containerWide: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 32,
  },
  dashboardNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: "#e5eaf2",
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  dashboardTitle: { color: "#20252c", fontSize: 20, fontWeight: "700" },
  dashboardNavRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  roleTag: {
    color: "#59636e",
    backgroundColor: "#f0f2f4",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 99,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  alertButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e8ec",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 99,
  },
  alertButtonText: { color: "#3f4b56", fontWeight: "700", fontSize: 10 },
  hero: {
    marginTop: 8,
    borderRadius: 10,
    padding: 18,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ebef",
  },
  heroWide: { padding: 20 },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  eyebrow: {
    color: "#78828e",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
    fontWeight: "800",
  },
  title: {
    color: "#20252c",
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  heroWelcome: {
    color: "#78828e",
    fontSize: 11,
    flexShrink: 1,
    textAlign: "right",
    marginHorizontal: 12,
  },
  heroWelcomeCompact: { display: "none" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#edf6f1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d5e9dd",
  },
  avatarText: { color: "#24845d", fontWeight: "700" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e8ebef",
  },
  summaryCardSelected: {
    backgroundColor: "#f4faf6",
    borderColor: "#aad3bc",
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  summaryLabel: {
    color: "#78828e",
    fontSize: 11,
    marginBottom: 6,
  },
  summaryValue: { color: "#20252c", fontSize: 20, fontWeight: "800" },
  section: { marginTop: 18 },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 18,
  },
  chartGraphic: {
    width: 184,
    height: 184,
    alignItems: "center",
    justifyContent: "center",
  },
  chartTotal: {
    position: "absolute",
    color: "#17264b",
    fontSize: 24,
    fontWeight: "900",
  },
  chartCaption: {
    position: "absolute",
    marginTop: 34,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  chartLegend: { flex: 1, minWidth: 180, gap: 6 },
  chartLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 9,
    gap: 8,
  },
  chartLegendDot: { width: 10, height: 10, borderRadius: 5 },
  chartLegendLabel: { color: "#475569", fontSize: 12, flex: 1 },
  chartLegendValue: { color: "#172033", fontSize: 13, fontWeight: "800" },
  chartEmpty: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  chartHelp: { color: "#64748b", fontSize: 11, lineHeight: 16, marginTop: 8 },
  moduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: "#20252c", fontSize: 17, fontWeight: "700" },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  actionCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: { color: "#111827", fontSize: 14, fontWeight: "700" },
  timerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5eaf2",
  },
  timerLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  timerValue: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  timerSub: { color: "#475569", fontSize: 12, marginTop: 8 },
  trackButton: {
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trackButtonDisabled: { opacity: 0.6 },
  trackButtonActive: { backgroundColor: "#1f5cff" },
  trackButtonText: { color: "#1f5cff", fontWeight: "800", fontSize: 12 },
  trackButtonTextActive: { color: "#fff" },
  notifyList: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    padding: 10,
  },
  notifyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4ff",
  },
  notifyDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  notifyBody: { flex: 1 },
  notifyTitle: { color: "#111827", fontWeight: "700", fontSize: 13 },
  notifyTime: { color: "#718096", fontSize: 11, marginTop: 3 },
  timelineCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5eaf2",
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start" },
  timelineTrack: { width: 24, alignItems: "center", marginRight: 12 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#cbd5e1",
  },
  timelineDotActive: { backgroundColor: "#1f5cff" },
  timelineLine: {
    width: 2,
    height: 28,
    backgroundColor: "#dfe7ff",
    marginTop: 4,
  },
  timelineBody: { flex: 1, paddingBottom: 14 },
  timelineLabel: { color: "#111827", fontWeight: "800", fontSize: 13 },
  timelineDetail: { color: "#475569", fontSize: 13, marginTop: 3 },
  timelineTime: { color: "#64748b", fontSize: 11, marginTop: 3 },
  linkedSectionHint: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "right",
    flexShrink: 1,
  },
  linkedTicketList: { gap: 10 },
  linkedTicketCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d8e3ff",
  },
  linkedTicketTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  linkedTicketCopy: { flex: 1 },
  linkedTicketCode: { color: "#1f5cff", fontSize: 12, fontWeight: "800" },
  linkedTicketAsset: {
    color: "#172033",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  linkedTicketStatus: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
  },
  linkedTicketMeta: { color: "#53627b", fontSize: 12, marginTop: 9 },
  linkedTicketParent: {
    color: "#5369a8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  queueHint: { color: "#718096", fontSize: 11, marginTop: 4 },
  linkText: { color: "#4257f6", fontWeight: "700" },
  searchBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#e7ebff",
    borderWidth: 1,
  },
  searchIcon: { color: "#8b93a7", fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, color: "#111827", fontSize: 14, paddingVertical: 12 },
  filtersRow: { paddingVertical: 14, gap: 10 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#edf2ff",
    borderWidth: 1,
    borderColor: "#dfe7ff",
  },
  filterPillActive: { backgroundColor: "#1f5cff", borderColor: "#1f5cff" },
  filterText: { color: "#4a5570", fontWeight: "700", fontSize: 12 },
  filterTextActive: { color: "#fff" },
  ticketList: { gap: 12, marginTop: 4 },
  ticketListWide: {
    gap: 0,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e8ebef",
    overflow: "hidden",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  paginationText: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  paginationActions: { flexDirection: "row", gap: 8 },
  pageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1f5cff",
    borderRadius: 10,
  },
  pageButtonDisabled: { opacity: 0.45 },
  pageButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  ticketCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5eaf2",
    shadowColor: "#6a78a8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  ticketCardWide: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: "#edf0f2",
    shadowOpacity: 0,
    elevation: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ticketRow: {
    flexDirection: "column",
  },
  ticketRowWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ticketCopy: {
    flex: 1,
    minWidth: 0,
  },
  ticketDetailsLink: {
    color: "#1f5cff",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
  },
  resolverLeaveNote: {
    color: "#9a5a12",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  ticketTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  ticketTopRowWide: { flex: 3, alignItems: "center" },
  ticketId: {
    color: "#6c7a99",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyText: { color: "#64748b", fontSize: 13, paddingVertical: 12 },
  ticketTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
    maxWidth: "88%",
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priorityText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  ticketMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  ticketMetaRowWide: { flex: 2, marginTop: 0, flexWrap: "wrap" },
  ticketMeta: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  separator: { color: "#9aa5ba" },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },
  progressWrapWide: { flex: 1, marginTop: 0 },
  statusBar: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    overflow: "hidden",
  },
  statusFill: { height: "100%", borderRadius: 999 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "800" },
  ticketDetailsLinkWide: { display: "none" },
});
