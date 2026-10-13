import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, TicketStatus } from '@prisma/client';
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
    const tickets = await this.prisma.ticket.findMany({
      where: visibility,
      include: { area: { select: { id: true, name: true } } },
    });
    const now = Date.now();
    const byStatus: Record<string, number> = {};
    const byArea = new Map<string, { areaId: string; name: string; open: number }>();

    for (const ticket of tickets) {
      byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1;
      const isOpen = !['CLOSED', 'CANCELLED'].includes(ticket.status);
      if (isOpen) {
        const current = byArea.get(ticket.areaId) ?? {
          areaId: ticket.areaId,
          name: ticket.area.name,
          open: 0,
        };
        current.open += 1;
        byArea.set(ticket.areaId, current);
      }
    }

    return {
      open: tickets.filter((t) => !['CLOSED', 'CANCELLED'].includes(t.status))
        .length,
      overdue: tickets.filter(
        (t) =>
          t.dueAt &&
          t.dueAt.getTime() < now &&
          !['CLOSED', 'CANCELLED'].includes(t.status),
      ).length,
      mine: tickets.filter(
        (t) => t.requesterId === user.id || t.assigneeId === user.id,
      ).length,
      byArea: [...byArea.values()].sort((a, b) => b.open - a.open),
      byStatus,
    };
  }

  async get(user: AuthUser, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        comments: {
          include: { author: { select: { id: true, name: true, email: true } } },
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

  async create(user: AuthUser, dto: CreateTicketDto) {
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId } });
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
      this.access.isAdmin(user) ||
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
        this.access.isAdmin(user) ||
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

  private async visibilityWhere(user: AuthUser): Promise<Prisma.TicketWhereInput> {
    if (this.access.isAdmin(user)) return {};
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
