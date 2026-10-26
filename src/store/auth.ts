import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { isAxiosError } from "axios";
import { create } from "zustand";
import {
  errorMessage,
  setApiToken,
  setUnauthorizedHandler,
} from "../api/client";
import { fetchMe, login } from "../api/tickets";
import { hydrateSession } from "./session-hydration";
import type { User } from "../types";

const KEY = "sd_token";
const web = Platform.OS === "web";
const ls = () => globalThis.localStorage;

const storage = {
  async get(): Promise<string | null> {
    if (web) return ls().getItem(KEY);
    return SecureStore.getItemAsync(KEY);
  },
  async set(v: string) {
    if (web) {
      ls().setItem(KEY, v);
      return;
    }
    await SecureStore.setItemAsync(KEY, v);
  },
  async clear() {
    if (web) {
      ls().removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};

interface AuthState {
  user: User | null;
  ready: boolean;
  sessionError: string | null;
  hydrate: () => Promise<void>;
  signIn: (empId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  sessionError: null,

  hydrate: () =>
    hydrateSession({
      readToken: () => storage.get(),
      fetchUser: () => fetchMe(),
      clearToken: () => storage.clear(),
      setApiToken,
      isUnauthorized: (error) =>
        isAxiosError(error) && error.response?.status === 401,
      describeError: errorMessage,
      setState: set,
    }),

  signIn: async (empId, password) => {
    const { token, user } = await login(empId.trim(), password);
    setApiToken(token);
    await storage.set(token);
    set({ user, sessionError: null });
  },

  signOut: async () => {
    setApiToken(null);
    await storage.clear();
    set({ user: null, sessionError: null });
  },
}));

setUnauthorizedHandler(() => {
  useAuth.getState().signOut();
});
