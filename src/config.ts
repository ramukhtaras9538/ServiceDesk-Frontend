import Constants from "expo-constants";
import { Platform } from "react-native";

const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

function validateOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid API origin.");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("EXPO_PUBLIC_API_URL must contain only an HTTP(S) origin.");
  }

  if (!isDevelopment && url.protocol !== "https:") {
    throw new Error("Production builds require an HTTPS EXPO_PUBLIC_API_URL.");
  }

  return url.origin;
}

function resolveOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return validateOrigin(fromEnv);

  if (!isDevelopment) {
    throw new Error(
      "Configure EXPO_PUBLIC_API_URL with the HTTPS API origin before building for production.",
    );
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000`;
  }

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:4000`;

  return Platform.OS === "android"
    ? "http://10.0.2.2:4000"
    : "http://localhost:4000";
}

export const API_ORIGIN = resolveOrigin();
export const API_URL = `${API_ORIGIN}/api`;
