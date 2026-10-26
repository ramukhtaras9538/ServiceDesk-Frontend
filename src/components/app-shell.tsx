import { Link, usePathname, type Href } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/store/auth";
import type { Role } from "@/types";

type SidebarItem = {
  label: string;
  href: Href;
  glyph: string;
};

const workspaceItems: SidebarItem[] = [
  { label: "Tickets", href: "/", glyph: "▤" },
  { label: "New ticket", href: "/create-ticket", glyph: "+" },
  { label: "Notifications", href: "/notifications", glyph: "◉" },
  { label: "Work records", href: "/records", glyph: "◷" },
  { label: "Operations", href: "/explore", glyph: "◫" },
];

const managementItems: SidebarItem[] = [
  { label: "Service catalog", href: "/catalog", glyph: "◇" },
  { label: "Resolver leave", href: "/leave", glyph: "◷" },
];

function SidebarSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: SidebarItem[];
  pathname: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/" && pathname.startsWith("/ticket/")) ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link key={item.label} href={item.href} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              style={({ pressed }) =>
                StyleSheet.flatten([
                styles.navItem,
                active && styles.navItemActive,
                pressed && styles.navItemPressed,
                ])
              }
            >
              <Text style={[styles.navGlyph, active && styles.navGlyphActive]}>
                {item.glyph}
              </Text>
              <Text style={[styles.navText, active && styles.navTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const user = useAuth((state) => state.user);
  const showSidebar = Boolean(user) && width >= 1080;

  return (
    <View style={styles.shell}>
      {showSidebar && user ? (
        <View accessibilityLabel="Main navigation" style={styles.sidebar}>
          <View style={styles.brand}>
            <BrandMark compact />
          </View>

          <View style={styles.navigation}>
            <SidebarSection
              label="WORKSPACE"
              items={workspaceItems}
              pathname={pathname}
            />
            <SidebarSection
              label="MANAGEMENT"
              items={
                user.role === "admin"
                  ? [
                      ...managementItems,
                      {
                        label: "User administration",
                        href: "/admin",
                        glyph: "⚙",
                      },
                    ]
                  : managementItems
              }
              pathname={pathname}
            />
          </View>

          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>
                {user.name}
              </Text>
              <Text style={styles.profileRole}>{roleLabel(user.role)}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

function roleLabel(role: Role) {
  return role === "admin"
    ? "Administrator"
    : role === "agent"
      ? "Agent"
      : "Requester";
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f7f8fa",
  },
  sidebar: {
    width: 236,
    minHeight: "100%",
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#e8ebef",
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 14,
  },
  brand: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  navigation: {
    flex: 1,
    gap: 22,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    color: "#9299a4",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  navItem: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 7,
    paddingHorizontal: 10,
  },
  navItemActive: {
    backgroundColor: "#edf6f1",
  },
  navItemPressed: {
    opacity: 0.7,
  },
  navGlyph: {
    width: 17,
    color: "#69727f",
    fontSize: 15,
    textAlign: "center",
  },
  navGlyphActive: {
    color: "#24845d",
  },
  navText: {
    color: "#4c5562",
    fontSize: 12,
    fontWeight: "600",
  },
  navTextActive: {
    color: "#1e6f4e",
    fontWeight: "700",
  },
  profile: {
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
    paddingTop: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#e8f2ed",
  },
  avatarText: {
    color: "#24845d",
    fontSize: 13,
    fontWeight: "800",
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: "#2a3038",
    fontSize: 11,
    fontWeight: "700",
  },
  profileRole: {
    color: "#87909b",
    fontSize: 10,
    marginTop: 3,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
