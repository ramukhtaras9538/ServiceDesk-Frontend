import { Link, useRouter } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createManagedUser,
  fetchAdminLinkedTickets,
  fetchManagedUsers,
  fetchMeta,
  fetchPasswordResetRequests,
  resetRequestedPassword,
  type PasswordResetRequest,
} from "@/api/tickets";
import { errorMessage } from "@/api/client";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { AdminTicketLink, ManagedUser, Meta } from "@/types";

type AccountRole = "user" | "agent";  

export default function AdminScreen() {
  const currentUser = useAuth((state) => state.user);
  const isAdmin = currentUser?.role === "admin";
  const [meta, setMeta] = useState<Meta | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [linkedTickets, setLinkedTickets] = useState<AdminTicketLink[]>([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState<
    PasswordResetRequest[]
  >([]);
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>(
    {},
  );
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [empId, setEmpId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("user");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    const [directory, catalog, resetRequests, links] = await Promise.all([
      fetchManagedUsers(),
      fetchMeta(),
      fetchPasswordResetRequests(),
      fetchAdminLinkedTickets(),
    ]);
    setUsers(directory);
    setMeta(catalog);
    setPasswordResetRequests(resetRequests);
    setLinkedTickets(links);
  };

  useEffect(() => {
    let active = true;
    if (!isAdmin) {
      return () => {
        active = false;
      };
    }
    Promise.all([
      fetchManagedUsers(),
      fetchMeta(),
      fetchPasswordResetRequests(),
      fetchAdminLinkedTickets(),
    ])
      .then(([directory, catalog, resetRequests, links]) => {
        if (active) {
          setUsers(directory);
          setMeta(catalog);
          setPasswordResetRequests(resetRequests);
          setLinkedTickets(links);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const linksRefresh = setInterval(() => {
      fetchAdminLinkedTickets()
        .then((links) => {
          if (active) setLinkedTickets(links);
        })
        .catch((reason: unknown) => {
          if (active) setError(errorMessage(reason));
        });
    }, 30_000);
    return () => {
      active = false;
      clearInterval(linksRefresh);
    };
  }, [isAdmin]);

  const resetPassword = async (request: PasswordResetRequest) => {
    const password = resetPasswords[request.id] ?? "";
    if (password.length < 12) {
      setError("Temporary passwords must contain at least 12 characters.");
      return;
    }
    setResettingId(request.id);
    setError("");
    setNotice("");
    try {  
      await resetRequestedPassword(request.id, password);
      setPasswordResetRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
      setResetPasswords((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setNotice(
        `Password reset for ${request.empId}. Give the temporary password to the employee after verifying their identity.`,
      );
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setResettingId(null);
    }
  };

  const submit = async () => {
    if (!empId.trim() || !name.trim() || password.length < 12) {
      setError(
        "Enter an employee ID, full name, and an initial password of at least 12 characters.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (role === "agent" && !departmentId) {
      setError("Choose a department for the agent.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await createManagedUser({
        empId: empId.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        role,
        departmentId: departmentId || undefined,
        password,
      });
      setUsers((current) => [created, ...current].slice(0, 100));
      setEmpId("");
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("user");
      setDepartmentId(null);
      setNotice(`${created.name} was added as a ${created.role}.`);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const router = useRouter();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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
    <ProtectedRoute requireAdmin>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader title="User administration">
            <View style={styles.navActions}>
              <Link href="/leave" asChild>
                <Text style={styles.navLink}>Resolver leave →</Text>
              </Link>
              <Link href="/catalog" asChild>
                <Text style={styles.navLink}>Request catalog →</Text>
              </Link>
              <Link href="/" replace asChild>
                <Text style={styles.navLink}>Dashboard →</Text>
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
            <Text style={styles.eyebrow}>ADMINISTRATION</Text>
            <Text style={styles.title}>People and access</Text>
          </View>

          {!isAdmin ? (
            <View style={styles.panel}>
              <Text style={styles.error}>
                Administrator access is required to manage accounts.
              </Text>
            </View>
          ) : (
            <>
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <View style={styles.panel}>
                <View style={styles.directoryHeader}>
                  <Text style={styles.panelTitle}>
                    Cross-department ticket process
                  </Text>
                  <Pressable
                    disabled={loading} 
                    onPress={() => {
                      setError("");
                      void fetchAdminLinkedTickets()
                        .then(setLinkedTickets)
                        .catch((reason: unknown) =>
                          setError(errorMessage(reason)),
                        );
                    }}
                  >
                    <Text style={styles.refresh}>Refresh</Text>
                  </Pressable>
                </View>
                <Text style={styles.helper}>
                  Follow each linked ticket and its status across departments.
                </Text>
                {linkedTickets.length === 0 ? (
                  <Text style={styles.helper}>
                    No cross-department tickets yet.
                  </Text>
                ) : null}
                {linkedTickets.map((link) => (
                  <View key={link.id} style={styles.resetRequest}>
                    <View style={styles.directoryHeader}>
                      <Link href={`/ticket/${link.sourceTicketId}` as any}>
                        <Text style={styles.userName}>
                          {link.sourceTicketCode} · {link.sourceDepartment}
                        </Text>
                      </Link>
                      <Text style={styles.userMeta}>{link.sourceStatus}</Text>
                    </View>
                    <View style={styles.directoryHeader}>
                      <Link href={`/ticket/${link.linkedTicketId}` as any}>
                        <Text style={styles.userName}>
                          {link.linkedTicketCode} · {link.targetDepartment}
                        </Text>
                      </Link>
                      <Text style={styles.userMeta}>{link.linkedStatus}</Text>
                    </View>
                    <Text style={styles.userMeta}>{link.note}</Text>
                    <Text style={styles.userMeta}>
                      Linked by {link.createdBy.name}
                      {link.createdAt
                        ? ` · ${new Date(link.createdAt).toLocaleString()}`
                        : ""}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.panel}>
                <View style={styles.directoryHeader}>
                  <Text style={styles.panelTitle}>Password reset requests</Text>
                  <Pressable
                    disabled={loading}
                    onPress={() => {
                      setError("");
                      void load().catch((reason: unknown) =>
                        setError(errorMessage(reason)),
                      );
                    }}
                  >
                    <Text style={styles.refresh}>Refresh</Text>
                  </Pressable>
                </View>
                <Text style={styles.helper}>
                  Verify each employee’s identity before setting and sharing a
                  temporary password.
                </Text>
                {!loading && passwordResetRequests.length === 0 ? (
                  <Text style={styles.helper}>No pending requests.</Text>
                ) : null}
                {passwordResetRequests.map((request) => (
                  <View key={request.id} style={styles.resetRequest}>
                    <Text style={styles.userName}>{request.name}</Text>
                    <Text style={styles.userMeta}>
                      {request.empId}
                      {request.email ? ` · ${request.email}` : ""}
                    </Text>
                    <Text style={styles.userMeta}>
                      Requested {new Date(request.createdAt).toLocaleString()}
                    </Text>
                    <TextInput
                      value={resetPasswords[request.id] ?? ""}
                      onChangeText={(value) =>
                        setResetPasswords((current) => ({
                          ...current,
                          [request.id]: value,
                        }))
                      }
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Temporary password (12+ characters)"
                      placeholderTextColor="#8994a8"
                      style={styles.input}
                    />
                    <Pressable
                      disabled={resettingId !== null}
                      onPress={() => void resetPassword(request)}
                      style={[
                        styles.resetButton,
                        resettingId !== null && styles.disabled,
                      ]}
                    >
                      <Text style={styles.resetButtonText}>
                        {resettingId === request.id
                          ? "Resetting…"
                          : "Verify and reset password"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Add a person</Text>
                <Text style={styles.label}>Account type</Text>
                <View style={styles.options}>
                  <Choice
                    label="Employee / requester"
                    selected={role === "user"}
                    onPress={() => setRole("user")}
                  />
                  <Choice
                    label="Support agent"
                    selected={role === "agent"}
                    onPress={() => setRole("agent")}
                  />
                </View>
                <Field
                  label="Employee ID"
                  value={empId}
                  onChangeText={setEmpId}
                  autoCapitalize="characters"
                  placeholder="e.g. A1042"
                />
                <Field
                  label="Full name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Employee full name"
                />
                <Field
                  label="Email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="name@psgtech.ac.in"
                />
                {role === "agent" ? (
                  <>
                    <Text style={styles.label}>Department assignment</Text>
                    <View style={styles.options}>
                      {(meta?.departments || []).map((department) => (
                        <Choice
                          key={department.id}
                          label={department.name}
                          selected={departmentId === department.id}
                          onPress={() => setDepartmentId(department.id)}
                        />
                      ))}
                    </View>
                  </>
                ) : null}
                <Field
                  label="Initial password (at least 12 characters)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Set a temporary password"
                />
                <Field
                  label="Confirm password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Re-enter the password"
                />
                <Pressable
                  disabled={saving}
                  onPress={() => void submit()}
                  style={[styles.submitButton, saving && styles.disabled]}
                >
                  <Text style={styles.submitText}>
                    {saving
                      ? "Creating account…"
                      : `Create ${role === "agent" ? "agent" : "user"}`}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.panel}>
                <View style={styles.directoryHeader}>
                  <Text style={styles.panelTitle}>Recent accounts</Text>
                  <Pressable
                    disabled={loading}
                    onPress={() => {
                      setError("");
                      void load().catch((reason: unknown) =>
                        setError(errorMessage(reason)),
                      );
                    }}
                  >
                    <Text style={styles.refresh}>Refresh</Text>
                  </Pressable>
                </View>
                {loading ? (
                  <Text style={styles.helper}>Loading accounts…</Text>
                ) : null}
                {!loading && users.length === 0 ? (
                  <Text style={styles.helper}>No accounts found.</Text>
                ) : null}
                {users.map((item) => (
                  <View key={item.id} style={styles.userRow}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userInitials}>
                        {item.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userMeta}>
                        {item.empId}
                        {item.department ? ` · ${item.department}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.roleTag}>{item.role}</Text>
                  </View>
                ))}
                {users.length === 100 ? (
                  <Text style={styles.helper}>
                    Showing the latest 100 accounts.
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

function Field({
  label,
  ...props
}: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} />
    </>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6fa" },
  container: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 40,
    gap: 14,
  },
  nav: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  navLink: { color: "#38539b", fontWeight: "800", fontSize: 12, padding: 8 },
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
  header: {
    backgroundColor: "#e9effb",
    borderColor: "#dce5f5",
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
  },
  eyebrow: {
    color: "#4262a7",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  title: { color: "#17243d", fontSize: 27, fontWeight: "900", marginTop: 8 },
  subtitle: {
    color: "#586984",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  panel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5eaf2",
    borderRadius: 16,
    padding: 18,
  },
  panelTitle: {
    color: "#17264b",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  label: {
    color: "#34415e",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 13,
    marginBottom: 8,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#f4f6fa",
    borderWidth: 1,
    borderColor: "#e4e8f0",
  },
  optionSelected: { backgroundColor: "#edf2ff", borderColor: "#7894dc" },
  optionText: { color: "#59657c", fontSize: 11, fontWeight: "700" },
  optionTextSelected: { color: "#2d4d9d" },
  input: {
    backgroundColor: "#fbfcfe",
    borderWidth: 1,
    borderColor: "#e1e6ef",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: "#17264b",
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: "#294aab",
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,
    marginTop: 18,
  },
  disabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  error: {
    color: "#b42318",
    backgroundColor: "#fff1f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  notice: {
    color: "#166b4d",
    backgroundColor: "#eaf8f1",
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    fontWeight: "800",
  },
  directoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resetRequest: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#edf0f5",
    paddingVertical: 14,
  },
  resetButton: {
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 11,
    backgroundColor: "#294aab",
    marginTop: 4,
  },
  resetButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  refresh: { color: "#38539b", fontWeight: "800", fontSize: 11, padding: 8 },
  helper: { color: "#7b879d", fontSize: 11, lineHeight: 17, marginTop: 6 },
  userRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderTopWidth: 1,
    borderTopColor: "#edf0f5",
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#edf2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  userInitials: { color: "#38539b", fontWeight: "900", fontSize: 13 },
  userInfo: { flex: 1 },
  userName: { color: "#17264b", fontWeight: "800", fontSize: 12 },
  userMeta: { color: "#7b879d", fontSize: 10, marginTop: 3 },
  roleTag: {
    color: "#38539b",
    backgroundColor: "#edf2ff",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "capitalize",
  },
});
