import { AxiosError, default as axios } from "axios";
import { API_URL } from "../config";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const url = error.config?.url ?? "";
    if (error.response?.status === 401 && !url.includes("/auth/login"))
      onUnauthorized?.();
    return Promise.reject(error);
  },
);

export function errorMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string }>;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === "ECONNABORTED" || err.message === "Network Error")
    return "Cannot reach the server. Check that the backend is running and your phone is on the same Wi-Fi.";
  return "Something went wrong. Try again.";
}
