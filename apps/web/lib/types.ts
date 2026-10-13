export type GlobalRole = "ADMIN" | "EMPLOYEE";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type AuthProfile = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  leadAreaIds: string[];
  memberships: {
    areaId: string;
    areaName: string;
    canAssign: boolean;
    canClose: boolean;
  }[];
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  globalRole: GlobalRole;
};

export type AreaMember = {
  userId: string;
  name: string;
  email: string;
  canAssign: boolean;
  canClose: boolean;
};

export type AreaNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  lead: { id: string; name: string; email: string } | null;
  members: AreaMember[];
  children: AreaNode[];
};

export type Ticket = {
  id: string;
  number: string;
  title: string;
  body: string;
  requesterId: string;
  areaId: string;
  assigneeId: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  area: { id: string; name: string; slug: string; leadUserId: string | null };
  requester: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string } | null;
};

export type TicketDetail = Ticket & {
  comments: {
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; email: string };
  }[];
  events: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actor: { id: string; name: string; email: string };
  }[];
  permissions: { canAssign: boolean; canClose: boolean };
};

export type Kpis = {
  open: number;
  overdue: number;
  mine: number;
  byArea: { areaId: string; name: string; open: number }[];
  byStatus: Record<string, number>;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  ticketId: string | null;
  readAt: string | null;
  createdAt: string;
};
