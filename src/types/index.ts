export type Role = "user" | "agent" | "admin";
export type Status = string;
export type Priority = string;
export type Scope = "raised" | "assigned" | "department" | "all";
export type CatalogKind =
  | "departments"
  | "categories"
  | "services"
  | "priorities"
  | "statuses";

export interface CatalogEntry {
  id: number | string;
  name: string;
  categoryId?: number;
  departmentId?: number;
}

export interface User {
  id: number;
  empId: string;
  name: string;
  email: string | null;
  role: Role;
  departmentId: number | null;
  department: string | null;
}

export interface Person {
  id: number;
  name: string;
  empId: string;
}

export interface Ticket {
  id: number;
  code: string;
  category: string;
  categoryId: number;
  service: string;
  serviceId: number;
  department: string;
  departmentId: number;
  asset: string;
  description: string | null;
  priority: Priority;
  expectedClosingDays: number | null;
  location: { block: string | null; floor: string | null; room: string | null };
  status: Status;
  createdBy: Person;
  assignedTo: Person | null;
  resolverOnLeave: (Person & { endDate: string }) | null;
  parentTicket: { id: number; code: string } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface TicketDetail extends Ticket {
  attachments: { id: number; name: string; mimetype: string; url: string }[];
  comments: {
    id: number;
    body: string;
    createdAt: string;
    author: { name: string; empId: string; role: Role };
  }[];
  timeline: {
    id: number;
    action: string;
    detail: string | null;
    createdAt: string;
    actor: { name: string; empId: string };
  }[];
  linkedTickets: {
    id: number;
    code: string;
    department: string;
    status: Status;
    note: string;
    createdAt: string | null;
    createdBy: Person;
  }[];
}

export interface AdminTicketLink {
  id: number;
  sourceTicketId: number;
  sourceTicketCode: string;
  linkedTicketId: number;
  linkedTicketCode: string;
  sourceDepartment: string;
  targetDepartment: string;
  sourceStatus: Status;
  linkedStatus: Status;
  note: string;
  createdBy: Person;
  createdAt: string | null;
}

export interface TicketList {
  data: Ticket[];
  total: number;
  page: number;
  limit: number;
  counts: Record<string, number>;
}

export interface ActivityItem {
  id: number;
  action: string;
  detail: string | null;
  createdAt: string;
  ticketId: number;
  ticketCode: string;
  ticketStatus: Status;
  actor: string;
}

export interface Meta {
  departments: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  services: {
    id: number;
    name: string;
    categoryId: number;
    departmentId: number;
  }[];
  priorities: Priority[];
  statuses: Status[];
}

export interface Agent {
  id: number;
  name: string;
  empId: string;
  departmentId: number | null;
  activeTicketCount: number;
  onLeave: boolean;
}

export interface Notification {
  id: number;
  ticketId: number | null;
  ticketCode: string | null;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface LeaveRecord {
  id: number;
  agentId: number;
  agent: Person;
  departmentId: number | null;
  startDate: string;
  endDate: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  createdAt: string;
}

export type ManagedUser = User;

export interface WorkSession {
  id: number;
  startedAt: string;
  stoppedAt: string | null;
  status: "active" | "completed";
  durationSeconds: number;
}

export interface WorkSessionSummary {
  sessions: WorkSession[];
  activeSession: WorkSession | null;
  trackedSecondsToday: number;
  sessionsToday: number;
}
