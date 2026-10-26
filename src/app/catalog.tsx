import { Link } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import {
  createCatalogEntry,
  deleteCatalogEntry,
  fetchCatalog,
  fetchMeta,
  updateCatalogEntry,
} from "@/api/tickets";
import { ProtectedRoute } from "@/components/protected-route";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/store/auth";
import type { CatalogEntry, CatalogKind, Meta } from "@/types";

const catalogKinds: { value: CatalogKind; label: string }[] = [
  { value: "departments", label: "Departments" },
  { value: "categories", label: "Categories" },
  { value: "services", label: "Services" },
  { value: "priorities", label: "Priorities" },
  { value: "statuses", label: "Statuses" },
];

const catalogIcons = {
  departments: "domain",
  categories: "shape-outline",
  services: "briefcase-outline",
  priorities: "flag-outline",
  statuses: "format-list-bulleted",
} as const;

function presentName(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function CatalogScreen() {
  const isDark = useColorScheme() === "dark";
  const styles = createStyles(isDark);
  const iconAccent = isDark ? "#a6baff" : "#3859b8";
  const iconMuted = isDark ? "#a0adc4" : "#697894";
  const iconSubtle = isDark ? "#8593ac" : "#8995aa";
  const iconDanger = isDark ? "#ffaaa2" : "#b54745";
  const iconInfo = isDark ? "#b5c8ff" : "#4564b8";
  const iconRow = isDark ? "#9db2ef" : "#52699d";
  const iconLocked = isDark ? "#a0adc4" : "#74819a";
  const isAdmin = useAuth((state) => state.user?.role === "admin");
  const [kind, setKind] = useState<CatalogKind>("departments");
  const [items, setItems] = useState<CatalogEntry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<
    number | string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    let active = true;
    fetchMeta()
      .then((result) => {
        if (active) setMeta(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchCatalog(kind)
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind]);

  const selectedKind = catalogKinds.find((item) => item.value === kind)!;
  const serviceReady =
    kind !== "services" || (categoryId !== null && departmentId !== null);
  const protectedStatus = (item: CatalogEntry) =>
    kind === "statuses" && ["open", "resolved"].includes(String(item.id));

  const resetForm = () => {
    setName("");
    setCategoryId(null);
    setDepartmentId(null);
    setEditingId(null);
  };

  const refreshCatalog = async () => {
    setItems(await fetchCatalog(kind));
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Enter a name for this option.");
      return;
    }
    if (!serviceReady) {
      setError("Choose both a category and a department for this service.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingId !== null) {
        await updateCatalogEntry(kind, editingId, {
          name: name.trim(),
          ...(kind === "services"
            ? { categoryId: categoryId!, departmentId: departmentId! }
            : {}),
        });
        setNotice(`${selectedKind.label.slice(0, -1)} updated.`);
      } else {
        await createCatalogEntry(kind, {
          name: name.trim(),
          ...(kind === "services"
            ? { categoryId: categoryId!, departmentId: departmentId! }
            : {}),
        });
        setNotice(`${selectedKind.label.slice(0, -1)} added.`);
      }
      resetForm();
      await refreshCatalog();
      setMeta(await fetchMeta());
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: CatalogEntry) => {
    setName(item.name);
    setEditingId(item.id);
    setConfirmRemoveId(null);
    if (item.categoryId !== undefined) setCategoryId(item.categoryId);
    if (item.departmentId !== undefined) setDepartmentId(item.departmentId);
    setError("");
    setNotice("");
  };

  const remove = async (item: CatalogEntry) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await deleteCatalogEntry(kind, item.id);
      if (editingId === item.id) resetForm();
      setConfirmRemoveId(null);
      await refreshCatalog();
      setMeta(await fetchMeta());
      setNotice(`${selectedKind.label.slice(0, -1)} removed.`);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const serviceCategories = useMemo(() => meta?.categories ?? [], [meta]);
  const serviceDepartments = useMemo(() => meta?.departments ?? [], [meta]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const category = serviceCategories.find(
        (entry) => entry.id === item.categoryId,
      )?.name;
      const department = serviceDepartments.find(
        (entry) => entry.id === item.departmentId,
      )?.name;
      return [item.name, category, department]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    });
  }, [items, search, serviceCategories, serviceDepartments]);
  const totalOptions = meta
    ? meta.departments.length +
      meta.categories.length +
      meta.services.length +
      meta.priorities.length +
      meta.statuses.length
    : items.length;

  return (
    <ProtectedRoute requireAdmin>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader title="Service catalog">
            <Link href="/admin" asChild>
              <Pressable accessibilityRole="button" style={styles.backButton}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={17}
                  color={iconAccent}
                />
                <Text style={styles.backText}>People and access</Text>
              </Pressable>
            </Link>
          </ScreenHeader>

          <Animated.View
            style={[
              styles.heroFrame,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.hero}>
              <View style={styles.heroOverlay}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroCopy}>
                    <View style={styles.eyebrowRow}>
                      <View style={styles.liveDot} />
                      <Text style={styles.eyebrow}>ADMIN WORKSPACE</Text>
                    </View>
                    <Text style={styles.title}>Request catalog</Text>
                    <Text style={styles.subtitle}>
                      Shape the options employees use to raise a request.
                      Changes are reflected across the service desk.
                    </Text>
                  </View>
                  <View style={styles.heroIcon}>
                    <MaterialCommunityIcons
                      name="tune-variant"
                      size={26}
                      color={iconAccent}
                    />
                  </View>
                </View>
                <View style={styles.heroFooter}>
                  <Text style={styles.heroFooterLabel}>CATALOG OPTIONS</Text>
                  <Text style={styles.heroFooterValue}>
                    {meta ? totalOptions : loading ? "…" : items.length}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {!isAdmin ? (
            <Text style={styles.error}>
              Administrator access is required to manage options.
            </Text>
          ) : (
            <>
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <View style={styles.kindPanel}>
                <View style={styles.kindHeading}>
                  <View>
                    <Text style={styles.panelEyebrow}>CONFIGURATION</Text>
                    <Text style={styles.panelTitle}>Browse catalog</Text>
                  </View>
                  <Text style={styles.kindHint}>5 collections</Text>
                </View>
                <View style={styles.kindOptions}>
                  {catalogKinds.map((item) => (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: kind === item.value }}
                      onPress={() => {
                        setKind(item.value);
                        setSearch("");
                        setLoading(true);
                        resetForm();
                        setConfirmRemoveId(null);
                        setError("");
                        setNotice("");
                      }}
                      style={[
                        styles.kindButton,
                        kind === item.value && styles.kindButtonSelected,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={catalogIcons[item.value]}
                        size={17}
                        color={kind === item.value ? "#fff" : iconMuted}
                      />
                      <Text
                        style={[
                          styles.kindText,
                          kind === item.value && styles.kindTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.contentGrid}>
                <Animated.View
                  style={[
                    styles.panel,
                    styles.formPanel,
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
                  <View style={styles.sectionHeading}>
                    <View style={styles.sectionIcon}>
                      <MaterialCommunityIcons
                        name={editingId === null ? "plus" : "pencil-outline"}
                        size={19}
                        color={iconAccent}
                      />
                    </View>
                    <View style={styles.sectionHeadingCopy}>
                      <Text style={styles.panelTitle}>
                        {editingId === null
                          ? "Create an option"
                          : "Edit option"}
                      </Text>
                      <Text style={styles.helper}>
                        {editingId === null
                          ? `Add to ${selectedKind.label.toLowerCase()}`
                          : `Updating ${selectedKind.label.toLowerCase()}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.label}>Option name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}

                    
                    maxLength={80}
                    placeholder={`Enter a ${selectedKind.label.slice(0, -1).toLowerCase()} name`}
                    placeholderTextColor="#9aa5b8"
                    style={styles.input}
                  />
                  {kind === "services" ? (
                    <>
                      <Text style={styles.label}>Category</Text>
                      <View style={styles.options}>
                        {serviceCategories.map((item) => (
                          <Choice
                            key={item.id}
                            label={item.name}
                            selected={categoryId === item.id}
                            onPress={() => setCategoryId(item.id)}
                            styles={styles}
                          />
                        ))}
                      </View>
                      <Text style={styles.label}>Department</Text>
                      <View style={styles.options}>
                        {serviceDepartments.map((item) => (
                          <Choice
                            key={item.id}
                            label={item.name}
                            selected={departmentId === item.id}
                            onPress={() => setDepartmentId(item.id)}
                            styles={styles}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                  <View style={styles.formActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving || !serviceReady}
                      onPress={() => void submit()}
                      style={[
                        styles.submitButton,
                        (saving || !serviceReady) && styles.disabled,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={editingId === null ? "plus" : "check"}
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.submitText}>
                        {saving
                          ? "Saving…"
                          : editingId === null
                            ? "Add option"
                            : "Save changes"}
                      </Text>
                    </Pressable>
                    {editingId !== null ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={resetForm}
                        style={styles.cancelButton}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Animated.View>

                <View style={[styles.panel, styles.listPanel]}>
                  <View style={styles.listHeader}>
                    <View style={styles.sectionHeading}>
                      <View style={styles.sectionIcon}>
                        <MaterialCommunityIcons
                          name={catalogIcons[kind]}
                          size={18}
                          color={iconAccent}
                        />
                      </View>
                      <View style={styles.sectionHeadingCopy}>
                        <Text style={styles.panelTitle}>
                          {selectedKind.label}
                        </Text>
                        <Text style={styles.helper}>
                          {loading
                            ? "Loading options…"
                            : `${items.length} ${
                                items.length === 1 ? "option" : "options"
                              }`}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Refresh catalog options"
                      disabled={loading}
                      style={styles.refreshButton}
                      onPress={() =>
                        void refreshCatalog().catch((reason: unknown) =>
                          setError(errorMessage(reason)),
                        )
                      }
                    >
                      <MaterialCommunityIcons
                        name="refresh"
                        size={17}
                        color={iconAccent}
                      />
                      <Text style={styles.refresh}>Refresh</Text>
                    </Pressable>
                  </View>
                  <View style={styles.searchBox}>
                    <MaterialCommunityIcons
                      name="magnify"
                      size={19}
                      color={iconSubtle}
                    />
                    <TextInput
                      accessibilityLabel={`Search ${selectedKind.label.toLowerCase()}`}
                      value={search}
                      onChangeText={setSearch}
                      placeholder={`Search ${selectedKind.label.toLowerCase()}`}
                      placeholderTextColor="#9aa5b8"
                      returnKeyType="search"
                      style={styles.searchInput}
                    />
                    {search ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        onPress={() => setSearch("")}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={18}
                          color={iconSubtle}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                  {kind === "statuses" ? (
                    <View style={styles.helperBanner}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={17}
                        color={iconInfo}
                      />
                      <Text style={styles.helperBannerText}>
                        Open and Resolved are required for ticket workflows.
                      </Text>
                    </View>
                  ) : null}
                  {!loading && filteredItems.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIcon}>
                        <MaterialCommunityIcons
                          name={search ? "magnify" : catalogIcons[kind]}
                          size={25}
                          color={iconSubtle}
                        />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {search ? "No matching options" : "Nothing here yet"}
                      </Text>
                      <Text style={styles.emptyText}>
                        {search
                          ? "Try another search term."
                          : "Create an option to add it to this catalog."}
                      </Text>
                    </View>
                  ) : null}
                  {filteredItems.map((item) => (
                    <View key={String(item.id)} style={styles.row}>
                      <View style={styles.rowIcon}>
                        <MaterialCommunityIcons
                          name={
                            kind === "statuses"
                              ? "check-circle-outline"
                              : catalogIcons[kind]
                          }
                          size={17}
                          color={iconRow}
                        />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>
                          {presentName(item.name)}
                        </Text>
                        {kind === "services" ? (
                          <Text style={styles.rowMeta}>
                            {serviceCategories.find(
                              (entry) => entry.id === item.categoryId,
                            )?.name ?? "Category"}{" "}
                            ·{" "}
                            {serviceDepartments.find(
                              (entry) => entry.id === item.departmentId,
                            )?.name ?? "Department"}
                          </Text>
                        ) : null}
                      </View>
                      {protectedStatus(item) ? (
                        <View style={styles.lockedBadge}>
                          <MaterialCommunityIcons
                            name="lock-outline"
                            size={12}
                            color={iconLocked}
                          />
                          <Text style={styles.locked}>Required</Text>
                        </View>
                      ) : confirmRemoveId === item.id ? (
                        <View style={styles.rowActions}>
                          <Pressable
                            accessibilityRole="button"
                            disabled={saving}
                            onPress={() => void remove(item)}
                            style={styles.confirmButton}
                          >
                            <Text style={styles.removeConfirm}>
                              {saving ? "Removing…" : "Confirm"}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Cancel removal"
                            onPress={() => setConfirmRemoveId(null)}
                            style={styles.iconButton}
                          >
                            <MaterialCommunityIcons
                              name="close"
                              size={16}
                              color={iconMuted}
                            />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.rowActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${item.name}`}
                            onPress={() => edit(item)}
                            style={styles.iconButton}
                          >
                            <MaterialCommunityIcons
                              name="pencil-outline"
                              size={16}
                              color={iconAccent}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${item.name}`}
                            onPress={() => setConfirmRemoveId(item.id)}
                            style={[styles.iconButton, styles.removeIconButton]}
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={16}
                              color={iconDanger}
                            />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

function Choice({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (dark: boolean) => {
  const colors = dark
    ? {
        canvas: "#0d1424",
        surface: "#151f32",
        surfaceAlt: "#1c2940",
        input: "#101a2c",
        border: "#2b3850",
        divider: "#27344b",
        text: "#edf3ff",
        textStrong: "#dce6ff",
        textMuted: "#a0adc4",
        textSubtle: "#8593ac",
        accent: "#91aaff",
        accentStrong: "#738eea",
        accentSoft: "#24345b",
        accentBorder: "#3d5288",
        danger: "#ffaaa2",
        dangerSoft: "#3d252c",
        dangerBorder: "#63353b",
        success: "#79d8b2",
        successSoft: "#17382f",
        successBorder: "#285644",
        infoSoft: "#202f4f",
        info: "#c0d0ff",
        lockedSoft: "#253149",
      }
    : {
        canvas: "#f4f6fa",
        surface: "#ffffff",
        surfaceAlt: "#f7f8fb",
        input: "#f9fafc",
        border: "#e6eaf1",
        divider: "#eef1f5",
        text: "#1c2944",
        textStrong: "#25324d",
        textMuted: "#59657c",
        textSubtle: "#8995aa",
        accent: "#3159b8",
        accentStrong: "#284d9f",
        accentSoft: "#eef2ff",
        accentBorder: "#cbd5f4",
        danger: "#b42318",
        dangerSoft: "#fff0ee",
        dangerBorder: "#ffe1dd",
        success: "#166b4d",
        successSoft: "#eaf8f1",
        successBorder: "#d5f0e2",
        infoSoft: "#f0f4ff",
        info: "#50628c",
        lockedSoft: "#f1f3f7",
      };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    container: {
      width: "100%",
      maxWidth: 1120,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 56,
      gap: 16,
    },
    nav: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backText: { color: colors.textStrong, fontSize: 12, fontWeight: "700" },
    heroFrame: { borderRadius: 10 },
    hero: {
      minHeight: 180,
      overflow: "hidden",
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroOverlay: {
      flex: 1,
      minHeight: 180,
      justifyContent: "space-between",
      padding: 22,
      borderRadius: 10,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
    },
    heroCopy: { flex: 1, maxWidth: 670 },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: "900",
    },
    title: {
      color: colors.textStrong,
      fontSize: 27,
      fontWeight: "700",
      letterSpacing: -0.8,
      marginTop: 12,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 9,
      maxWidth: 520,
    },
    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    heroFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 20,
    },
    heroFooterLabel: {
      color: colors.textSubtle,
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: "800",
    },
    heroFooterValue: {
      color: colors.textStrong,
      fontSize: 15,
      fontWeight: "800",
    },
    kindPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 20,
      shadowColor: "#0c1930",
      shadowOpacity: dark ? 0.16 : 0.035,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    kindHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    panelEyebrow: {
      color: colors.textSubtle,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: "800",
      marginBottom: 5,
    },
    kindHint: { color: colors.textSubtle, fontSize: 11, fontWeight: "600" },
    contentGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: 16,
    },
    panel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 20,
      shadowColor: "#0c1930",
      shadowOpacity: dark ? 0.16 : 0.035,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    formPanel: { flexGrow: 1, flexShrink: 1, flexBasis: 350 },
    listPanel: { flexGrow: 1, flexShrink: 1, flexBasis: 420 },
    panelTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    sectionHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
    sectionIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionHeadingCopy: { flex: 1, gap: 3 },
    kindOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
      marginTop: 16,
    },
    kindButton: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 9,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kindButtonSelected: {
      backgroundColor: colors.accentStrong,
      borderColor: colors.accentStrong,
      shadowColor: "#253f8d",
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    kindText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    kindTextSelected: { color: "#fff" },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 20,
      marginBottom: 9,
    },
    input: {
      minHeight: 48,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 14,
    },
    options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    choice: {
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    choiceSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentBorder,
    },
    choiceText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    choiceTextSelected: { color: dark ? "#c5d2ff" : "#344fa7" },
    formActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 24,
    },
    submitButton: {
      minHeight: 46,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 7,
      borderRadius: 13,
      paddingHorizontal: 17,
      backgroundColor: colors.accentStrong,
      shadowColor: "#253f8d",
      shadowOpacity: 0.14,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    submitText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    cancelButton: {
      minHeight: 42,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    cancelText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    disabled: { opacity: 0.55 },
    listHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 16,
    },
    refreshButton: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
    },
    refresh: {
      color: dark ? "#c5d2ff" : colors.accent,
      fontWeight: "700",
      fontSize: 11,
    },
    helper: { color: colors.textSubtle, fontSize: 11, lineHeight: 17 },
    searchBox: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      minHeight: 42,
      padding: 0,
      color: colors.text,
      fontSize: 12,
    },
    helperBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 11,
      marginBottom: 8,
      borderRadius: 11,
      backgroundColor: colors.infoSoft,
    },
    helperBannerText: {
      flex: 1,
      color: colors.info,
      fontSize: 10,
      lineHeight: 15,
    },
    emptyState: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 30,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      marginBottom: 12,
    },
    emptyTitle: { color: colors.textStrong, fontSize: 13, fontWeight: "800" },
    emptyText: {
      color: colors.textSubtle,
      fontSize: 11,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 5,
    },
    row: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },
    rowInfo: { flex: 1, paddingVertical: 11 },
    rowName: { color: colors.textStrong, fontWeight: "700", fontSize: 12 },
    rowMeta: { color: colors.textSubtle, fontSize: 10, marginTop: 4 },
    rowActions: { flexDirection: "row", gap: 6, alignItems: "center" },
    iconButton: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
    },
    removeIconButton: { backgroundColor: colors.dangerSoft },
    confirmButton: {
      minHeight: 32,
      justifyContent: "center",
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor: colors.dangerSoft,
    },
    removeConfirm: { color: colors.danger, fontSize: 10, fontWeight: "800" },
    lockedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: colors.lockedSoft,
    },
    locked: { color: colors.textSubtle, fontSize: 9, fontWeight: "700" },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      padding: 12,
      fontSize: 12,
      lineHeight: 18,
    },
    notice: {
      color: colors.success,
      backgroundColor: colors.successSoft,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.successBorder,
      padding: 12,
      fontSize: 12,
      fontWeight: "800",
    },
  });
};
