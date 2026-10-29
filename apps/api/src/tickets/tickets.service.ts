import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type TicketStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AccessService } from '../auth/access.service.js';
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

const ticketInclude = {
  area: { select: { id: true, name: true, slug: true, leadUserId: true } },
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
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
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
    const visibility = await this.visibilityWhere(user);
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
    const visibility = await this.visibilityWhere(user);
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
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!(await this.access.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }
    return {
      ...ticket,
      permissions: {
        canAssign: await this.access.canAssign(user, ticket.areaId),
        canClose: await this.access.canClose(user, ticket.areaId),
      },
    };
  }

  async recordRead(user: AuthUser, id: string) {
    const ticket = await this.requireTicket(id);
    if (!(await this.access.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }
    // A stable primary key makes concurrent/retried reads a single atomic insert.
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
      // Some adapters emulate upsert; a racing insert still has one winner.
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
    const tickets = await this.prisma.ticket.findMany({
      where: await this.visibilityWhere(user),
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        createdAt: true,
        area: { select: { name: true } },
        events: {
          where: { type: { in: ['READ', 'STATUS_CHANGED'] } },
          select: {
            type: true,
            message: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true } },
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
        // Older status events use this exact server-authored message format.
        const transition =
          event.type === 'STATUS_CHANGED'
            ? /^Status (OPEN|IN_PROGRESS|WAITING|RESOLVED|CLOSED|CANCELLED) → (IN_PROGRESS|RESOLVED)$/.exec(
                event.message,
              )
            : null;
        const kind =
          event.type === 'READ'
            ? 'read'
            : transition && transition[1] !== transition[2]
              ? transition[2] === 'IN_PROGRESS'
                ? 'started'
                : 'resolved'
              : null;
        const elapsedMs =
          event.createdAt.getTime() - ticket.createdAt.getTime();
        if (!kind || elapsedMs < 0) continue;
        const milestone = {
          at: event.createdAt,
          elapsedMs,
          actor: event.actor,
        };
        if (kind === 'read') firstRead ??= milestone;
        if (kind === 'started') firstStarted ??= milestone;
        if (kind === 'resolved') firstResolved ??= milestone;
        const key = `${kind}:${event.actor.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const person = people.get(event.actor.id) ?? {
          actor: event.actor,
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
    if (dto.assigneeId && !(await this.access.canAssign(user, dto.areaId))) {
      throw new ForbiddenException('You cannot assign tickets in this area');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.ticketCounter.upsert({
        where: { id: 1 },
        create: { id: 1, value: 1 },
        update: { value: { increment: 1 } },
      });
      const number = `CW-${String(counter.value).padStart(4, '0')}`;
      return tx.ticket.create({
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
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: 'CREATED',
        message: `Created ${ticket.number} for ${area.name}`,
      },
    });

    if (dto.assigneeId) {
      await this.prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'ASSIGNED',
          message: 'Assigned on creation',
        },
      });
    }

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
      this.access.isCompanyWide(user) ||
      ticket.requesterId === user.id ||
      ticket.assigneeId === user.id ||
      (await this.access.canManageArea(user, ticket.areaId));
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
    return updated;
  }

  async assign(user: AuthUser, id: string, dto: AssignTicketDto) {
    const ticket = await this.requireTicket(id);
    if (!(await this.access.canAssign(user, ticket.areaId))) {
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
    if (dto.status === 'CLOSED' || dto.status === 'CANCELLED') {
      if (!(await this.access.canClose(user, ticket.areaId))) {
        throw new ForbiddenException('You cannot close tickets in this area');
      }
    } else {
      const canMove =
        this.access.isCompanyWide(user) ||
        ticket.assigneeId === user.id ||
        (await this.access.canAssign(user, ticket.areaId));
      if (!canMove) throw new ForbiddenException();
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
      include: ticketInclude,
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: user.id,
        type: dto.status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
        message: `Status ${ticket.status} → ${dto.status}`,
      },
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
    if (!(await this.access.canViewTicket(user, ticket))) {
      throw new ForbiddenException();
    }
    const comment = await this.prisma.ticketComment.create({
      data: { ticketId: id, authorId: user.id, body: dto.body },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: user.id,
        type: 'COMMENTED',
        message: 'Added a comment',
      },
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
        body: `${user.name} commented on the ticket`,
      });
    }
    return comment;
  }

  private async requireTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: ticketInclude,
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private async visibilityWhere(
    user: AuthUser,
  ): Promise<Prisma.TicketWhereInput> {
    if (this.access.isCompanyWide(user)) return {};
    const areaIds = (await this.access.visibleAreaIds(user)) ?? [];
    return {
      OR: [
        { requesterId: user.id },
        { assigneeId: user.id },
        { areaId: { in: areaIds } },
      ],
    };
  }
}
