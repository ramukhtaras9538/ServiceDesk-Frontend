import { Link, useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { createTicket, fetchMeta } from "@/api/tickets";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { Meta, Priority } from "@/types";

export default function CreateTicketScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [asset, setAsset] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("");
  const [expectedClosingDays, setExpectedClosingDays] = useState("");
  const [block, setBlock] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [files, setFiles] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      damping: 18,
      stiffness: 110,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchMeta()
        .then((result) => {
          if (active) {
            setMeta(result);
            setPriority((current) =>
              result.priorities.includes(current)
                ? current
                : (result.priorities[0] ?? ""),
            );
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(errorMessage(reason));
        })
        .finally(() => {
          if (active) setLoadingMeta(false);
        });

      return () => {
        active = false;
      };   
    }, []),
  );

  const services = useMemo(
    () =>
      (meta?.services || []).filter(
        (service) => service.categoryId === categoryId,
      ),
    [categoryId, meta],
  );
  const selectedService = services.find((service) => service.id === serviceId);
  const department = meta?.departments.find(
    (item) => item.id === selectedService?.departmentId,
  );

  const chooseFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ["image/png", "image/jpeg", "application/pdf"],
      });

      if (result.canceled) {
        return;
      }

      const additions = result.assets.map((file) => ({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      }));

      setFiles((current) => {
        if (current.length + additions.length > 5) {
          setError("A ticket can include up to 5 attachments.");
          return current;
        }
        return [...current, ...additions];
      });
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  };

  const submit = async () => {
    if (!categoryId || !selectedService || !asset.trim() || !priority) {
      setError(
        "Choose a category and service, set a priority, and describe what needs attention.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const ticket = await createTicket({
        categoryId,
        serviceId: selectedService.id,
        departmentId: selectedService.departmentId,
        asset: asset.trim(),
        description: description.trim() || undefined, 
        priority,
        expectedClosingDays: expectedClosingDays || undefined,
        block: block.trim() || undefined,
        floor: floor.trim() || undefined,
        room: room.trim() || undefined,
        files,
      });

      router.replace(`/ticket/${ticket.id}` as any);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
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
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader title="New ticket">
            <View style={styles.navActions}>
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

          <Animated.View
            style={[
              styles.header,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.eyebrow}>CAMPUS SUPPORT</Text>
            <Text style={styles.title}>Create a service request</Text>
            <Text style={styles.subtitle}>
              Tell us what is happening. We’ll route it to the right team and
              keep you updated.
            </Text>
          </Animated.View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {loadingMeta ? (
            <Text style={styles.helper}>Loading request options…</Text>
          ) : null}

          {meta ? (
            <>
              <Animated.View style={[styles.panel, { opacity: entrance }]}>
                <Text style={styles.panelTitle}>1. Choose a service</Text>
                <Text style={styles.label}>Category</Text>
                <View style={styles.options}>
                  {meta.categories.map((item) => (
                    <Option
                      key={item.id}
                      label={item.name}
                      selected={categoryId === item.id}
                      onPress={() => {
                        setCategoryId(item.id);
                        setServiceId(null);
                      }}
                    />
                  ))}
                </View>

                {categoryId ? (
                  <>
                    <Text style={styles.label}>Service type</Text>
                    <View style={styles.options}>
                      {services.map((item) => (
                        <Option
                          key={item.id}
                          label={item.name}
                          selected={serviceId === item.id}
                          onPress={() => setServiceId(item.id)}
                        />
                      ))}
                      {services.length === 0 ? (
                        <Text style={styles.helper}>
                          No service options are set up for this category.
                        </Text>
                      ) : null}
                    </View>
                  </>
                ) : null}

                {department ? (
                  <Text style={styles.routeHint}>
                    Routed to{" "}
                    <Text style={styles.routeName}>{department.name}</Text>
                  </Text>
                ) : null}
              </Animated.View>

              <Animated.View
                style={[
                  styles.panel,
                  {
                    opacity: entrance,
                    transform: [
                      {
                        scale: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.panelTitle}>2. Request details</Text>
                <FieldLabel>Request title</FieldLabel>
                <TextInput
                  value={asset}
                  onChangeText={setAsset}
                  maxLength={120}
                  placeholder="e.g. Projector not turning on"
                  style={styles.input}
                />
                <FieldLabel>Description</FieldLabel>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  maxLength={2000}
                  multiline
                  placeholder="Share the symptoms and anything the support team should know"
                  style={[styles.input, styles.multiline]}
                />

                <Text style={styles.label}>Priority level</Text>
                <Text style={styles.helper}>
                  Choose the urgency that best describes the impact.
                </Text>
                <View style={styles.options}>
                  {meta.priorities.map((item) => (
                    <Option
                      key={item}
                      label={item
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (character) =>
                          character.toUpperCase(),
                        )}
                      selected={priority === item}
                      onPress={() => setPriority(item)}
                    />
                  ))}
                  {meta.priorities.length === 0 ? (
                    <Text style={styles.helper}>
                      An administrator needs to add a priority before requests
                      can be submitted.
                    </Text>
                  ) : null}
                </View>

                <FieldLabel>Expected resolution (days, optional)</FieldLabel>
                <TextInput
                  value={expectedClosingDays}
                  onChangeText={setExpectedClosingDays}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="e.g. 3"
                  style={styles.input}
                />
              </Animated.View>

              <Animated.View style={[styles.panel, { opacity: entrance }]}>
                <Text style={styles.panelTitle}>
                  3. Location and attachments
                </Text>
                <View style={styles.locationRow}>
                  <TextInput
                    value={block}
                    onChangeText={setBlock}
                    maxLength={40}
                    placeholder="Block"
                    style={[styles.input, styles.locationInput]}
                  />
                  <TextInput
                    value={floor}
                    onChangeText={setFloor}
                    maxLength={20}
                    placeholder="Floor"
                    style={[styles.input, styles.locationInput]}
                  />
                  <TextInput
                    value={room}
                    onChangeText={setRoom}
                    maxLength={20}
                    placeholder="Room"
                    style={[styles.input, styles.locationInput]}
                  />
                </View>

                <Pressable
                  onPress={() => void chooseFiles()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    Add files or photos · up to 5
                  </Text>
                </Pressable>

                {files.map((file, index) => (
                  <View key={`${file.uri}-${index}`} style={styles.fileRow}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setFiles((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Text style={styles.removeFile}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </Animated.View>

              <Pressable
                disabled={saving || loadingMeta}
                onPress={() => void submit()}
                style={[
                  styles.submitButton,
                  (saving || loadingMeta) && styles.disabled,
                ]}
              >
                <Text style={styles.submitText}>
                  {saving ? "Submitting request…" : "Submit service request"}
                </Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Option({
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
  navActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    borderColor: "#e7ebf3",
    borderRadius: 18,
    padding: 18,
  },
  panelTitle: {
    color: "#17264b",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 14,
  },
  label: {
    color: "#34415e",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 13,
    marginBottom: 8,
  },
  helper: { color: "#7b879d", fontSize: 11, lineHeight: 17, marginBottom: 8 },
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
  routeHint: { marginTop: 12, fontSize: 11, color: "#72809a" },
  routeName: { color: "#3153a6", fontWeight: "900" },
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
  multiline: { minHeight: 96, textAlignVertical: "top" },
  locationRow: { flexDirection: "row", gap: 8 },
  locationInput: { flex: 1, minWidth: 70 },
  secondaryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#dce3f0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#38539b", fontWeight: "800", fontSize: 12 },
  fileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eef0f5",
    paddingVertical: 9,
    gap: 12,
  },
  fileName: { flex: 1, color: "#59657c", fontSize: 11 },
  removeFile: { color: "#b42318", fontWeight: "800", fontSize: 11 },
  error: {
    color: "#b42318",
    backgroundColor: "#fff1f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: "#294aab",
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,
  },
  disabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});
