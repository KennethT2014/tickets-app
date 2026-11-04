export type { GlobalRole } from "./roles";
import type { GlobalRole } from "./roles";

export type TicketStatus =
  "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED" | "CANCELLED";

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
  path?: string;
  depth?: number;
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

export type TicketCommentItem = {
  id: string;
  body: string;
  visibility: "PUBLIC" | "INTERNAL";
  createdAt: string;
  author: { id: string; name: string; email: string };
};

export type TicketLinkItem = {
  id: string;
  type: "PARENT_OF" | "RELATED" | "DUPLICATE_OF";
  fromTicket?: { id: string; number: string; title: string; status: TicketStatus };
  toTicket?: { id: string; number: string; title: string; status: TicketStatus };
};

export type AttachmentItem = {
  id: string;
  ticketId: string;
  commentId?: string | null;
  areaId: string;
  uploaderId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader: { id: string; name: string; email: string };
};

export type TicketDetail = Ticket & {
  comments: TicketCommentItem[];
  attachments?: AttachmentItem[];
  events: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actor: { id: string; name: string; email: string };
  }[];
  linksFrom?: TicketLinkItem[];
  linksTo?: TicketLinkItem[];
  isWatching?: boolean;
  permissions: {
    canAssign: boolean;
    canClose: boolean;
    canAddInternalComment?: boolean;
  };
};

export type QuickReplyItem = {
  id: string;
  areaId: string;
  title: string;
  body: string;
  createdAt: string;
  creator: { id: string; name: string };
};

export type KpiAreaSummary = {
  areaId: string;
  name: string;
  open: number;
  unassigned?: number;
  overdue?: number;
  critical?: number;
};

export type KpiActivityEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor: { id: string; name: string; email: string };
  ticket: {
    id: string;
    number: string;
    title: string;
    areaName: string;
  };
};

export type Kpis = {
  total?: number;
  open: number;
  overdue: number;
  dueSoon?: number;
  unassigned?: number;
  criticalOpen?: number;
  slaCompliancePct?: number;
  resolutionRatePct?: number;
  mine: number;
  byArea: KpiAreaSummary[];
  byStatus: Record<string, number>;
  byPriority?: Record<string, number>;
  recentEvents?: KpiActivityEvent[];
};

export type AuditMilestone = {
  at: string;
  elapsedMs: number;
  actor: { id: string; name: string; email: string };
};

export type AuditReport = {
  tickets: {
    id: string;
    number: string;
    title: string;
    status: TicketStatus;
    createdAt: string;
    area: { name: string };
    firstRead: AuditMilestone | null;
    firstStarted: AuditMilestone | null;
    firstResolved: AuditMilestone | null;
  }[];
  people: {
    actor: AuditMilestone["actor"];
    read: { count: number; averageMs: number | null };
    started: { count: number; averageMs: number | null };
    resolved: { count: number; averageMs: number | null };
  }[];
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  ticketId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type AuditLogEntry = {
  id: string;
  seq: number;
  occurredAt: string;
  actorId: string | null;
  actorRole: string | null;
  actorRank: number | null;
  action: string;
  result: "SUCCESS" | "DENIED" | "ERROR";
  entityType: string;
  entityId: string | null;
  areaId: string | null;
  areaPath: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  prevHash: string;
  hash: string;
};

export type AuditLogsResponse = {
  logs: AuditLogEntry[];
  total: number;
  take: number;
  skip: number;
};

export type AuditIntegrityResponse = {
  valid: boolean;
  totalChecked: number;
  brokenSeq?: number;
  error?: string;
};
