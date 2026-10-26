import { api } from "./client";
import { Platform } from "react-native";
import type {
  ActivityItem,
  AdminTicketLink,
  Agent,
  CatalogEntry,
  CatalogKind,
  LeaveRecord,
  ManagedUser,
  Meta,
  Notification,
  Priority,
  Scope,
  Status,
  TicketDetail,
  TicketList,
  User,
  WorkSession,
  WorkSessionSummary,
} from "../types";

export const login = (empId: string, password: string) =>
  api
    .post<{ token: string; user: User }>("/auth/login", { empId, password })
    .then((r) => r.data);

export const requestPasswordReset = (empId: string) =>
  api
    .post<{ message: string }>("/auth/forgot-password", { empId })
    .then((response) => response.data);

export const fetchMe = () =>
  api.get<{ user: User }>("/auth/me").then((r) => r.data.user);
export const fetchMeta = () => api.get<Meta>("/meta").then((r) => r.data);
export const fetchAgents = () =>
  api.get<{ agents: Agent[] }>("/agents").then((r) => r.data.agents);
export const fetchNotifications = () =>
  api
    .get<{
      notifications: Notification[];
      unreadCount: number;
    }>("/notifications")
    .then((r) => r.data);
export const markNotificationRead = (id: number) =>
  api.patch(`/notifications/${id}/read`);
export const fetchWorkSessions = () =>
  api
    .get<WorkSessionSummary>("/work-sessions")
    .then((response) => response.data);
export const startWorkSession = () =>
  api
    .post<{ session: WorkSession }>("/work-sessions/start")
    .then((response) => response.data.session);
export const stopWorkSession = (id: number) =>
  api
    .post<{ session: WorkSession }>(`/work-sessions/${id}/stop`)
    .then((response) => response.data.session);
export const fetchManagedUsers = () =>
  api.get<{ users: ManagedUser[] }>("/admin/users").then((r) => r.data.users);
export const fetchLeaves = () =>
  api.get<{ leaves: LeaveRecord[] }>("/leave").then((r) => r.data.leaves);
export const createLeave = (input: { startDate: string; endDate: string }) =>
  api
    .post<{ leave: LeaveRecord }>("/leave", input)
    .then((response) => response.data.leave);
export const cancelLeave = (id: number) =>
  api
    .delete<{ leave: LeaveRecord }>(`/leave/${id}`)
    .then((response) => response.data.leave);
export const fetchAdminLinkedTickets = () =>
  api
    .get<{ links: AdminTicketLink[] }>("/admin/linked-tickets")
    .then((response) => response.data.links);

export interface PasswordResetRequest {
  id: number;
  empId: string;
  name: string;
  email: string | null;
  createdAt: string;
}

export const fetchPasswordResetRequests = () =>
  api
    .get<{ requests: PasswordResetRequest[] }>("/admin/password-reset-requests")
    .then((response) => response.data.requests);

export const resetRequestedPassword = (id: number, password: string) =>
  api.post(`/admin/password-reset-requests/${id}/reset`, { password });

export interface NewManagedUser {
  empId: string;
  name: string;
  email?: string;
  role: "user" | "agent";
  departmentId?: number;
  password: string;
}

export const createManagedUser = (input: NewManagedUser) =>
  api
    .post<{ user: ManagedUser }>("/admin/users", input)
    .then((r) => r.data.user);

export async function fetchCatalog(kind: CatalogKind): Promise<CatalogEntry[]> {
  const response = await api.get<{ items: (CatalogEntry | string)[] }>(
    `/admin/catalog/${kind}`,
  );
  return response.data.items.map((item) =>
    typeof item === "string" ? { id: item, name: item } : item,
  );
}

export const createCatalogEntry = (
  kind: CatalogKind,
  input: { name: string; categoryId?: number; departmentId?: number },
) =>
  api
    .post<{ item: CatalogEntry | string }>(`/admin/catalog/${kind}`, input)
    .then(({ data }) =>
      typeof data.item === "string"
        ? { id: data.item, name: data.item }
        : data.item,
    );

export const updateCatalogEntry = (
  kind: CatalogKind,
  id: number | string,
  input: { name: string; categoryId?: number; departmentId?: number },
) =>
  api
    .patch<{
      item: CatalogEntry | string;
    }>(`/admin/catalog/${kind}/${encodeURIComponent(String(id))}`, input)
    .then(({ data }) =>
      typeof data.item === "string"
        ? { id: data.item, name: data.item }
        : data.item,
    );

export const deleteCatalogEntry = (kind: CatalogKind, id: number | string) =>
  api.delete(`/admin/catalog/${kind}/${encodeURIComponent(String(id))}`);

export interface TicketQuery {
  scope: Scope;
  search?: string;
  department?: number;
  priority?: Priority;
  status?: Status;
  statusGroup?: "open" | "resolved";
  linkedOnly?: boolean;
  sort?: "created" | "updated";
  page?: number;
  limit?: number;
}

export const fetchTickets = (q: TicketQuery) =>
  api
    .get<TicketList>("/tickets", { params: { limit: 100, ...q } })
    .then((r) => r.data);

export const fetchTicket = (id: number) =>
  api
    .get<{ ticket: TicketDetail }>(`/tickets/${id}`)
    .then((r) => r.data.ticket);

export interface NewTicket {
  categoryId: number;
  serviceId: number;
  departmentId: number;
  asset: string;
  description?: string;
  priority: Priority;
  expectedClosingDays?: string;
  block?: string;
  floor?: string;
  room?: string;
  files: { uri: string; name: string; type: string }[];
}

export async function createTicket(input: NewTicket) {
  const form = new FormData();
  const { files, ...fields } = input;
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== "") form.append(k, String(v));
  });
  for (const file of files) {
    if (Platform.OS === "web") {
      const response = await fetch(file.uri);
      if (!response.ok)
        throw new Error(`Could not read attachment: ${file.name}`);
      form.append("files", await response.blob(), file.name);
    } else {
      // React Native's FormData accepts { uri, name, type } objects for files.
      form.append("files", file as unknown as Blob);
    }
  }
  const res = await api.post<{ ticket: TicketDetail }>("/tickets", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return res.data.ticket;
}

export const setTicketStatus = (id: number, status: Status) =>
  api
    .patch<{ ticket: TicketDetail }>(`/tickets/${id}/status`, { status })
    .then((r) => r.data.ticket);

export const assignTicket = (id: number, assigneeId: number, note?: string) =>
  api
    .patch<{ ticket: TicketDetail }>(`/tickets/${id}/assign`, {
      assigneeId,
      ...(note ? { note } : {}),
    })
    .then((r) => r.data.ticket);

export interface NewLinkedTicket {
  categoryId: number;
  serviceId: number;
  departmentId: number;
  asset: string;
  description?: string;
  priority: Priority;
  note: string;
}

export const createLinkedTicket = (id: number, input: NewLinkedTicket) =>
  api
    .post<{ ticket: TicketDetail }>(`/tickets/${id}/links`, input)
    .then((response) => response.data.ticket);

export const postComment = (id: number, body: string) =>
  api
    .post<{ ticket: TicketDetail }>(`/tickets/${id}/comments`, { body })
    .then((r) => r.data.ticket);

export const fetchActivity = (params: {
  scope: Scope;
  search?: string;
  date?: string;
}) =>
  api
    .get<{ data: ActivityItem[] }>("/activity", { params })
    .then((r) => r.data.data);
