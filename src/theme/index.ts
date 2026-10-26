import { Platform, TextStyle, ViewStyle } from "react-native";
import type { Priority, Status } from "../types";

export const colors = {
  ink: "#0A1236",
  navy: "#12215E",
  royal: "#2342C7",
  royalSoft: "#E9EEFF",
  bg: "#F3F5FA",
  surface: "#FFFFFF",
  line: "#E3E7F1",
  text: "#121A33",
  muted: "#576080",
  faint: "#8E96AE",
  gold: "#C9A24B",
  goldSoft: "#F6EDD7",
  danger: "#D64545",
  dangerSoft: "#FCE9E9",
  white: "#FFFFFF",
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const fonts = {
  display: "PlusJakartaSans_700Bold",
  displayHeavy: "PlusJakartaSans_800ExtraBold",
  displayMed: "PlusJakartaSans_600SemiBold",
  body: "Inter_400Regular",
  bodyMed: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
};

export const type = {
  hero: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    letterSpacing: -0.6,
    color: colors.white,
  } as TextStyle,
  h1: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.4,
    color: colors.text,
  } as TextStyle,
  h2: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.2,
    color: colors.text,
  } as TextStyle,
  title: {
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.text,
  } as TextStyle,
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  } as TextStyle,
  bodyMuted: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  } as TextStyle,
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.text,
  } as TextStyle,
  small: {
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    color: colors.muted,
  } as TextStyle,
  tiny: {
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    color: colors.faint,
  } as TextStyle,
};

export const shadow = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#14214F",
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 3 },
    default: { boxShadow: "0 8px 24px rgba(20,33,79,0.07)" } as ViewStyle,
  }) as ViewStyle,
  float: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0A1236",
      shadowOpacity: 0.28,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 12 },
    default: { boxShadow: "0 14px 34px rgba(10,18,54,0.28)" } as ViewStyle,
  }) as ViewStyle,
};

export const STATUS_META: Record<
  Status,
  { label: string; color: string; soft: string; icon: string }
> = {
  open: {
    label: "Open",
    color: "#6552B8",
    soft: "#EEEAFB",
    icon: "radio-button-on",
  },
  in_progress: {
    label: "In progress",
    color: "#D98400",
    soft: "#FFF2D9",
    icon: "time",
  },
  resolved: {
    label: "Resolved",
    color: "#1F9D63",
    soft: "#DFF5EA",
    icon: "checkmark-circle",
  },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; soft: string }
> = {
  low: { label: "Low", color: "#4C7A5A", soft: "#E6F2EA" },
  medium: { label: "Medium", color: "#2F6FD0", soft: "#E4EEFC" },
  high: { label: "High", color: "#D98400", soft: "#FFF2D9" },
  critical: { label: "Critical", color: "#D64545", soft: "#FCE9E9" },
};

export const STATUS_ORDER: Status[] = ["open", "in_progress", "resolved"];
