import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type TicketStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AuditService } from '../audit/audit.service.js';
import { PolicyService } from '../auth/policy.service.js';
import { getRoleRank } from '../auth/roles.js';
import type { AuthUser } from '../auth/auth.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AssignTicketDto,
  CommentTicketDto,
  CreateTicketDto,
  StatusTicketDto,
  UpdateTicketDto,
} from './tickets.schemas.js';

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING', 'RESOLVED', 'CANCELLED'],
  WAITING: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: ['IN_PROGRESS'], // Reopening requires justification and management/lead authorization
  CANCELLED: [],
};

const ticketInclude = {
  area: { select: { id: true, name: true, slug: true, leadUserId: true, path: true } },
  requester: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

type AuditMilestone = {
  at: Date;
  elapsedMs: number;
  actor: { id: string; name: string; email: string };
};
type AuditAverage = { count: number; averageMs: number | null };
type AuditPerson = {
  actor: AuditMilestone['actor'];
  read: AuditAverage;
  started: AuditAverage;
  resolved: AuditAverage;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditService,
  ) {}

  async list(
    user: AuthUser,
    query: {
      status?: TicketStatus;
      areaId?: string;
      assigneeId?: string;
      q?: string;
      mine?: string;
    },
  ) {
    const visibility = await this.policy.ticketWhere(user);
    const where: Prisma.TicketWhereInput = {
      AND: [
        visibility,
        query.status ? { status: query.status } : {},
        query.areaId ? { areaId: query.areaId } : {},
        query.assigneeId ? { assigneeId: query.assigneeId } : {},
        query.mine === 'true'
          ? { OR: [{ requesterId: user.id }, { assigneeId: user.id }] }
          : {},
        query.q
          ? {
              OR: [
                { title: { contains: query.q } },
                { number: { contains: query.q } },
                { body: { contains: query.q } },
              ],
            }
          : {},
      ],
    };

    return this.prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async kpis(user: AuthUser) {
    const visibility = await this.policy.ticketWhere(user);
    const [tickets, recentRawEvents] = await Promise.all([
      this.prisma.ticket.findMany({
        where: visibility,
        include: { area: { select: { id: true, name: true } } },
      }),
      this.prisma.ticketEvent.findMany
        ? this.prisma.ticketEvent.findMany({
            where: { ticket: visibility },
            include: {
              actor: { select: { id: true, name: true, email: true } },
              ticket: {
                select: {
                  id: true,
                  number: true,
                  title: true,
                  area: { select: { name: true } },
                },
              },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 8,
          })
        : Promise.resolve([]),
    ]);
    const now = Date.now();
    const soonWindowMs = 48 * 3_600_000;
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byArea = new Map<
      string,
      {
        areaId: string;
        name: string;
        open: number;
        unassigned: number;
        overdue: number;
        critical: number;
      }
    >();

    let open = 0;
    let overdue = 0;
    let dueSoon = 0;
    let unassigned = 0;
    let criticalOpen = 0;
    let resolvedOrClosed = 0;

    for (const ticket of tickets) {
      byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1;
      byPriority[ticket.priority] = (byPriority[ticket.priority] ?? 0) + 1;
      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        resolvedOrClosed += 1;
      }
      const isOpen = !['CLOSED', 'CANCELLED'].includes(ticket.status);
      if (isOpen) {
        open += 1;
        const dueMs = ticket.dueAt ? ticket.dueAt.getTime() : null;
        const isTicketOverdue = dueMs !== null && dueMs < now;
        const isTicketDueSoon =
          dueMs !== null && dueMs >= now && dueMs <= now + soonWindowMs;
        const isTicketUnassigned = !ticket.assigneeId;
        const isTicketCritical =
          ticket.priority === 'URGENT' || ticket.priority === 'HIGH';

        if (isTicketOverdue) overdue += 1;
        if (isTicketDueSoon) dueSoon += 1;
        if (isTicketUnassigned) unassigned += 1;
        if (isTicketCritical) criticalOpen += 1;

        const current = byArea.get(ticket.areaId) ?? {
          areaId: ticket.areaId,
          name: ticket.area.name,
          open: 0,
          unassigned: 0,
          overdue: 0,
          critical: 0,
        };
        current.open += 1;
        if (isTicketUnassigned) current.unassigned += 1;
        if (isTicketOverdue) current.overdue += 1;
        if (isTicketCritical) current.critical += 1;
        byArea.set(ticket.areaId, current);
      }
    }

    const total = tickets.length;
    const slaCompliancePct =
      total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;
    const resolutionRatePct =
      total > 0 ? Math.round((resolvedOrClosed / total) * 100) : 0;

    return {
      total,
      open,
      overdue,
      dueSoon,
      unassigned,
      criticalOpen,
      slaCompliancePct,
      resolutionRatePct,
      mine: tickets.filter(
        (t) => t.requesterId === user.id || t.assigneeId === user.id,
      ).length,
      byArea: [...byArea.values()].sort((a, b) => b.open - a.open),
      byStatus,
      byPriority,
      recentEvents: recentRawEvents.map((ev) => ({
        id: ev.id,
        type: ev.type,
        message: ev.message,
        createdAt: ev.createdAt,
        actor: ev.actor,
        ticket: {
          id: ev.ticket.id,
          number: ev.ticket.number,
          title: ev.ticket.title,
          areaName: ev.ticket.area.name,
        },
      })),
    };
  }

  async get(user: AuthUser, id: string) {
    const isMemberOrManager =
      this.policy.isCompanyWide(user) || (await this.policy.canAssign(user, (await this.requireTicket(id)).areaId));

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        comments: {
          where: isMemberOrManager ? {} : { visibility: 'PUBLIC' },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        linksFrom: {
          include: {
            toTicket: { select: { id: true, number: true, title: true, status: true } },
          },
        },
        linksTo: {
          include: {
            fromTicket: { select: { id: true, number: true, title: true, status: true } },
          },
        },
        watchers: {
          select: { userId: true },
        },
        attachments: {
          include: {
            uploader: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!(await this.policy.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }
    const isWatching = (ticket.watchers ?? []).some((w) => w.userId === user.id);
    return {
      ...ticket,
      isWatching,
      permissions: {
        canAssign: await this.policy.canAssign(user, ticket.areaId),
        canClose: await this.policy.canClose(user, ticket.areaId, ticket.requesterId),
        canAddInternalComment: isMemberOrManager,
      },
    };
  }

  async recordRead(user: AuthUser, id: string) {
    const ticket = await this.requireTicket(id);
    if (!(await this.policy.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }
    const eventId = `read_${createHash('sha256')
      .update(JSON.stringify([id, user.id]))
      .digest('hex')}`;
    try {
      return await this.prisma.ticketEvent.upsert({
        where: { id: eventId },
        create: {
          id: eventId,
          ticketId: id,
          actorId: user.id,
          type: 'READ',
          message: 'Viewed ticket detail',
        },
        update: {},
        select: { createdAt: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.ticketEvent.findUniqueOrThrow({
          where: { id: eventId },
          select: { createdAt: true },
        });
      }
      throw error;
    }
  }

  async audit(user: AuthUser) {
    const userRank = getRoleRank(user.globalRole);
    const tickets = await this.prisma.ticket.findMany({
      where: await this.policy.ticketWhere(user),
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        createdAt: true,
        area: { select: { name: true } },
        events: {
          where: { type: { in: ['READ', 'STATUS_CHANGED', 'CLOSED'] } },
          select: {
            type: true,
            message: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true, globalRole: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const people = new Map<string, AuditPerson>();
    const rows = tickets.map(({ events, ...ticket }) => {
      let firstRead: AuditMilestone | null = null;
      let firstStarted: AuditMilestone | null = null;
      let firstResolved: AuditMilestone | null = null;
      const seen = new Set<string>();
      for (const event of events) {
        let kind: 'read' | 'started' | 'resolved' | null = null;
        if (event.type === 'READ') {
          kind = 'read';
        } else if (event.type === 'STATUS_CHANGED' || event.type === 'CLOSED') {
          if (event.toStatus) {
            if (event.fromStatus !== event.toStatus) {
              if (event.toStatus === 'IN_PROGRESS') kind = 'started';
              else if (event.toStatus === 'RESOLVED') kind = 'resolved';
            }
          } else {
            // Fallback parsing for legacy messages
            const transition = /^Status (OPEN|IN_PROGRESS|WAITING|RESOLVED|CLOSED|CANCELLED) → (IN_PROGRESS|RESOLVED)$/.exec(
              event.message,
            );
            if (transition && transition[1] !== transition[2]) {
              kind = transition[2] === 'IN_PROGRESS' ? 'started' : 'resolved';
            }
          }
        }

        const elapsedMs =
          event.createdAt.getTime() - ticket.createdAt.getTime();
        if (!kind || elapsedMs < 0) continue;
        const milestone = {
          at: event.createdAt,
          elapsedMs,
          actor: { id: event.actor.id, name: event.actor.name, email: event.actor.email },
        };
        if (kind === 'read') firstRead ??= milestone;
        if (kind === 'started') firstStarted ??= milestone;
        if (kind === 'resolved') firstResolved ??= milestone;

        // Rank-based audit filtering: actor can only see performance stats of actors with rank <= actor's rank
        const actorRank = getRoleRank(event.actor.globalRole);
        if (actorRank > userRank && event.actor.id !== user.id) {
          continue; // Do not expose supervisor/management audit metrics to lower ranks
        }

        const key = `${kind}:${event.actor.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const person = people.get(event.actor.id) ?? {
          actor: { id: event.actor.id, name: event.actor.name, email: event.actor.email },
          read: { count: 0, averageMs: null },
          started: { count: 0, averageMs: null },
          resolved: { count: 0, averageMs: null },
        };
        const metric = person[kind];
        metric.averageMs =
          ((metric.averageMs ?? 0) * metric.count + elapsedMs) /
          (metric.count + 1);
        metric.count += 1;
        people.set(event.actor.id, person);
      }
      return { ...ticket, firstRead, firstStarted, firstResolved };
    });
    return {
      tickets: rows,
      people: [...people.values()].sort(
        (a, b) =>
          a.actor.name.localeCompare(b.actor.name) ||
          a.actor.id.localeCompare(b.actor.id),
      ),
    };
  }

  async create(user: AuthUser, dto: CreateTicketDto) {
    const area = await this.prisma.area.findUnique({
      where: { id: dto.areaId },
    });
    if (!area) throw new NotFoundException('Area not found');
    if (dto.assigneeId && !(await this.policy.canAssign(user, dto.areaId))) {
      throw new ForbiddenException('You cannot assign tickets in this area');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.ticketCounter.upsert({
        where: { id: 1 },
        create: { id: 1, value: 1 },
        update: { value: { increment: 1 } },
      });
      const number = `CW-${String(counter.value).padStart(4, '0')}`;
      const createdTicket = await tx.ticket.create({
        data: {
          number,
          title: dto.title,
          body: dto.body,
          areaId: dto.areaId,
          requesterId: user.id,
          assigneeId: dto.assigneeId ?? null,
          priority: dto.priority ?? 'MEDIUM',
          category: dto.category,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        },
        include: ticketInclude,
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: createdTicket.id,
          actorId: user.id,
          type: 'CREATED',
          message: `Created ${createdTicket.number} for ${area.name}`,
          toStatus: 'OPEN',
        },
      });

      if (dto.assigneeId) {
        await tx.ticketEvent.create({
          data: {
            ticketId: createdTicket.id,
            actorId: user.id,
            type: 'ASSIGNED',
            message: 'Assigned on creation',
          },
        });
      }

      await this.auditLog.record(
        {
          actor: user,
          action: 'ticket.create',
          result: 'SUCCESS',
          entityType: 'Ticket',
          entityId: createdTicket.id,
          areaId: area.id,
          areaPath: area.path,
          after: { number: createdTicket.number, title: createdTicket.title },
        },
        tx,
      );

      return createdTicket;
    });

    const recipients = new Set<string>();
    if (area.leadUserId) recipients.add(area.leadUserId);
    if (ticket.assigneeId) recipients.add(ticket.assigneeId);
    for (const userId of recipients) {
      await this.notifications.notify({
        userId,
        actorId: user.id,
        ticketId: ticket.id,
        title: ticket.number,
        body: `${user.name} created a request for ${area.name}`,
      });
    }

    return ticket;
  }

  async update(user: AuthUser, id: string, dto: UpdateTicketDto) {
    const ticket = await this.requireTicket(id);
    const canEdit =
      this.policy.isCompanyWide(user) ||
      ticket.requesterId === user.id ||
      ticket.assigneeId === user.id ||
      (await this.policy.canManageArea(user, ticket.areaId));
    if (!canEdit) throw new ForbiddenException();

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        priority: dto.priority,
        category: dto.category === undefined ? undefined : dto.category,
        dueAt:
          dto.dueAt === undefined
            ? undefined
            : dto.dueAt
              ? new Date(dto.dueAt)
              : null,
      },
      include: ticketInclude,
    });

    if (dto.priority && dto.priority !== ticket.priority) {
      await this.prisma.ticketEvent.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'PRIORITY_CHANGED',
          message: `Priority ${ticket.priority} → ${dto.priority}`,
        },
      });
    }

    await this.auditLog.record({
      actor: user,
      action: 'ticket.update',
      result: 'SUCCESS',
      entityType: 'Ticket',
      entityId: id,
      areaId: ticket.areaId,
      areaPath: ticket.area.path,
      before: { title: ticket.title, priority: ticket.priority },
      after: { title: updated.title, priority: updated.priority },
    });

    return updated;
  }

  async assign(user: AuthUser, id: string, dto: AssignTicketDto) {
    const ticket = await this.requireTicket(id);
    if (!(await this.policy.canAssign(user, ticket.areaId))) {
      throw new ForbiddenException('You cannot assign tickets in this area');
    }
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { assigneeId: dto.assigneeId },
      include: ticketInclude,
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: user.id,
        type: 'ASSIGNED',
        message: dto.assigneeId
          ? `Assigned to ${updated.assignee?.name ?? dto.assigneeId}`
          : 'Unassigned',
      },
    });

    await this.auditLog.record({
      actor: user,
      action: 'ticket.assign',
      result: 'SUCCESS',
      entityType: 'Ticket',
      entityId: id,
      areaId: ticket.areaId,
      areaPath: ticket.area.path,
      before: { assigneeId: ticket.assigneeId },
      after: { assigneeId: dto.assigneeId },
    });

    if (dto.assigneeId) {
      await this.notifications.notify({
        userId: dto.assigneeId,
        actorId: user.id,
        ticketId: id,
        title: ticket.number,
        body: `${user.name} assigned this ticket to you`,
      });
    }
    return updated;
  }

  async changeStatus(user: AuthUser, id: string, dto: StatusTicketDto) {
    const ticket = await this.requireTicket(id);

    // State machine check: validate if transition from ticket.status to dto.status is permitted
    const allowedTargets = VALID_TRANSITIONS[ticket.status] ?? [];
    if (!allowedTargets.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${ticket.status} to ${dto.status}`,
      );
    }

    // Role and authorization check for status change
    if (dto.status === 'CLOSED' || dto.status === 'CANCELLED') {
      if (!(await this.policy.canClose(user, ticket.areaId, ticket.requesterId))) {
        throw new ForbiddenException(
          ticket.requesterId === user.id
            ? 'Segregation of duties: Requesters cannot close their own requests'
            : 'You cannot close tickets in this area',
        );
      }
    } else if (ticket.status === 'CLOSED' && dto.status === 'IN_PROGRESS') {
      // Reopening a closed ticket requires management or area leadership
      const canReopen =
        this.policy.isCompanyWide(user) || (await this.policy.canManageArea(user, ticket.areaId));
      if (!canReopen) {
        throw new ForbiddenException('Only managers or area leads can reopen closed tickets');
      }
    } else {
      const canMove =
        this.policy.isCompanyWide(user) ||
        ticket.assigneeId === user.id ||
        (await this.policy.canAssign(user, ticket.areaId));
      if (!canMove) throw new ForbiddenException();
    }

    const now = new Date();
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        waitingUntil: dto.status === 'WAITING' ? (dto.waitingUntil ? new Date(dto.waitingUntil) : null) : null,
        resolvedAt: dto.status === 'RESOLVED' ? (ticket.resolvedAt ?? now) : undefined,
        closedAt: dto.status === 'CLOSED' || dto.status === 'CANCELLED' ? (ticket.closedAt ?? now) : undefined,
      },
      include: ticketInclude,
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: user.id,
        type: dto.status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
        fromStatus: ticket.status,
        toStatus: dto.status,
        message: `Status ${ticket.status} → ${dto.status}`,
      },
    });

    await this.auditLog.record({
      actor: user,
      action: 'ticket.transition',
      result: 'SUCCESS',
      entityType: 'Ticket',
      entityId: id,
      areaId: ticket.areaId,
      areaPath: ticket.area.path,
      before: { status: ticket.status },
      after: { status: dto.status },
    });

    const recipients = new Set(
      [ticket.requesterId, ticket.assigneeId, ticket.area.leadUserId].filter(
        (value): value is string => Boolean(value),
      ),
    );
    for (const userId of recipients) {
      await this.notifications.notify({
        userId,
        actorId: user.id,
        ticketId: id,
        title: ticket.number,
        body: `${user.name} moved the ticket to ${dto.status.replaceAll('_', ' ').toLowerCase()}`,
      });
    }
    return updated;
  }

  async comment(user: AuthUser, id: string, dto: CommentTicketDto) {
    const ticket = await this.requireTicket(id);
    if (!(await this.policy.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }

    const isInternal = dto.visibility === 'INTERNAL';
    // Only area staff/managers can post internal comments
    if (isInternal) {
      const canInternal =
        this.policy.isCompanyWide(user) || (await this.policy.canAssign(user, ticket.areaId));
      if (!canInternal) {
        throw new ForbiddenException('Only area members can add internal comments');
      }
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body: dto.body,
        visibility: dto.visibility ?? 'PUBLIC',
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: user.id,
        type: 'COMMENTED',
        message: isInternal ? 'Added an internal note' : 'Added a comment',
      },
    });

    await this.auditLog.record({
      actor: user,
      action: isInternal ? 'ticket.comment.internal' : 'ticket.comment',
      result: 'SUCCESS',
      entityType: 'Ticket',
      entityId: id,
      areaId: ticket.areaId,
      areaPath: ticket.area.path,
    });

    const recipients = new Set(
      [ticket.requesterId, ticket.assigneeId, ticket.area.leadUserId].filter(
        (value): value is string => Boolean(value),
      ),
    );
    // Don't notify requester about internal notes
    if (isInternal) {
      recipients.delete(ticket.requesterId);
    }

    for (const userId of recipients) {
      await this.notifications.notify({
        userId,
        actorId: user.id,
        ticketId: id,
        title: ticket.number,
        body: isInternal
          ? `${user.name} added an internal note to the ticket`
          : `${user.name} commented on the ticket`,
      });
    }
    return comment;
  }

  async transfer(user: AuthUser, id: string, targetAreaId: string, reason?: string) {
    const ticket = await this.requireTicket(id);
    const canTransfer =
      this.policy.isCompanyWide(user) || (await this.policy.canAssign(user, ticket.areaId));
    if (!canTransfer) {
      throw new ForbiddenException('You cannot transfer tickets from this area');
    }

    const targetArea = await this.prisma.area.findUnique({ where: { id: targetAreaId } });
    if (!targetArea) throw new NotFoundException('Target area not found');

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        areaId: targetAreaId,
        assigneeId: null, // Reset assignee upon department transfer
      },
      include: ticketInclude,
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: user.id,
        type: 'TRANSFERRED',
        message: `Transferred from ${ticket.area.name} to ${targetArea.name}${reason ? `: ${reason}` : ''}`,
      },
    });

    await this.auditLog.record({
      actor: user,
      action: 'ticket.transfer',
      result: 'SUCCESS',
      entityType: 'Ticket',
      entityId: id,
      areaId: targetAreaId,
      areaPath: targetArea.path,
      before: { areaId: ticket.areaId, areaName: ticket.area.name },
      after: { areaId: targetArea.id, areaName: targetArea.name },
      reason,
    });

    if (targetArea.leadUserId) {
      await this.notifications.notify({
        userId: targetArea.leadUserId,
        actorId: user.id,
        ticketId: id,
        title: ticket.number,
        body: `${user.name} transferred ticket to ${targetArea.name}`,
      });
    }

    return updated;
  }

  async link(user: AuthUser, fromId: string, toTarget: string, type: 'PARENT_OF' | 'RELATED' | 'DUPLICATE_OF') {
    const fromTicket = await this.requireTicket(fromId);
    if (!(await this.policy.canViewTicket(user, fromTicket))) {
      throw new ForbiddenException();
    }

    const toTicket = await this.prisma.ticket.findFirst({
      where: { OR: [{ id: toTarget }, { number: toTarget }] },
      include: ticketInclude,
    });
    if (!toTicket) throw new NotFoundException('Target ticket not found');
    if (!(await this.policy.canViewTicket(user, toTicket))) {
      throw new ForbiddenException('You cannot link a ticket you do not have permission to view');
    }
    if (fromTicket.id === toTicket.id) {
      throw new BadRequestException('A ticket cannot be linked to itself');
    }

    const link = await this.prisma.ticketLink.upsert({
      where: {
        fromId_toId_type: {
          fromId: fromTicket.id,
          toId: toTicket.id,
          type,
        },
      },
      create: {
        fromId: fromTicket.id,
        toId: toTicket.id,
        type,
        createdById: user.id,
      },
      update: {},
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: fromTicket.id,
        actorId: user.id,
        type: 'LINKED',
        message: `Linked as ${type} to ${toTicket.number}`,
      },
    });

    // If duplicate, optionally mark as CANCELLED with reason
    if (type === 'DUPLICATE_OF' && fromTicket.status !== 'CANCELLED' && fromTicket.status !== 'CLOSED') {
      if (await this.policy.canClose(user, fromTicket.areaId, fromTicket.requesterId)) {
        await this.prisma.ticket.update({
          where: { id: fromTicket.id },
          data: { status: 'CANCELLED' },
        });
        await this.prisma.ticketEvent.create({
          data: {
            ticketId: fromTicket.id,
            actorId: user.id,
            type: 'CLOSED',
            fromStatus: fromTicket.status,
            toStatus: 'CANCELLED',
            message: `Status ${fromTicket.status} → CANCELLED (Duplicate of ${toTicket.number})`,
          },
        });
      }
    }

    await this.auditLog.record({
      actor: user,
      action: 'ticket.link',
      result: 'SUCCESS',
      entityType: 'Ticket',
      entityId: fromTicket.id,
      areaId: fromTicket.areaId,
      areaPath: fromTicket.area.path,
      after: { linkedTo: toTicket.number, type },
    });

    return link;
  }

  async toggleWatch(user: AuthUser, id: string) {
    const ticket = await this.requireTicket(id);
    if (!(await this.policy.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }

    const existing = await this.prisma.ticketWatcher.findUnique({
      where: { ticketId_userId: { ticketId: id, userId: user.id } },
    });

    if (existing) {
      await this.prisma.ticketWatcher.delete({
        where: { ticketId_userId: { ticketId: id, userId: user.id } },
      });
      return { watching: false };
    } else {
      await this.prisma.ticketWatcher.create({
        data: { ticketId: id, userId: user.id },
      });
      return { watching: true };
    }
  }

  async addAttachment(
    user: AuthUser,
    ticketId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    commentId?: string,
  ) {
    const ticket = await this.requireTicket(ticketId);
    if (!(await this.policy.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }

    const uploadDir = path.resolve(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${Date.now()}-${randomBytes(8).toString('hex')}-${safeBase}`;
    const fullPath = path.join(uploadDir, storagePath);

    await fs.writeFile(fullPath, file.buffer);

    const attachment = await this.prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        commentId: commentId || null,
        areaId: ticket.areaId,
        uploaderId: user.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: 'COMMENTED',
        message: `Attached file: ${file.originalname} (${Math.round(file.size / 1024)} KB)`,
      },
    });

    await this.auditLog.record({
      actor: user,
      action: 'ticket.attachment.upload',
      result: 'SUCCESS',
      entityType: 'Attachment',
      entityId: attachment.id,
      areaId: ticket.areaId,
      areaPath: ticket.area?.path ?? null,
      after: { filename: file.originalname, sizeBytes: file.size },
    });

    return attachment;
  }

  async getAttachment(user: AuthUser, ticketId: string, attachmentId: string) {
    const ticket = await this.requireTicket(ticketId);
    if (!(await this.policy.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }

    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const uploadDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, attachment.storagePath);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Attachment file not found on disk');
    }

    return { attachment, filePath };
  }

  private async requireTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: ticketInclude,
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }
}

