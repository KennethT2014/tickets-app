import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import { PolicyService } from '../auth/policy.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TicketsService } from './tickets.service.js';

const user: AuthUser = {
  id: 'reader',
  name: 'Reader',
  email: 'reader@example.test',
  globalRole: 'EMPLOYEE',
};
const other = { id: 'other', name: 'Other', email: 'other@example.test' };
const createdAt = new Date('2026-01-01T00:00:00Z');
const ticket = {
  id: 'ticket',
  number: 'CW-0001',
  title: 'Request',
  createdAt,
  requesterId: 'requester',
  assigneeId: null,
  areaId: 'area',
  status: 'OPEN',
  area: { id: 'area', name: 'Support', leadUserId: null },
};
const event = (
  type: string,
  message: string,
  minutes: number,
  actor = user,
) => ({
  type,
  message,
  actor,
  actorId: actor.id,
  createdAt: new Date(createdAt.getTime() + minutes * 60_000),
});

describe('Ticket audit', () => {
  let service: TicketsService;
  let prisma: ReturnType<typeof mocks>;
  let policy: PolicyService;
  let audit: AuditService;

  function mocks() {
    return {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(ticket),
        findMany: vi.fn().mockResolvedValue([]),
      },
      ticketEvent: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn() },
      ticketWatcher: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
      attachment: { findFirst: vi.fn(), create: vi.fn() },
      area: { findMany: vi.fn().mockResolvedValue([]) },
      areaMembership: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    };
  }

  beforeEach(() => {
    prisma = mocks();
    policy = new PolicyService(prisma as unknown as PrismaService);
    audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    service = new TicketsService(
      prisma as unknown as PrismaService,
      policy,
      {} as NotificationsService,
      audit,
    );
  });

  it('rejects hidden and missing tickets before recording any read', async () => {
    await expect(service.recordRead(user, 'ticket')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(service.recordRead(user, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.ticketEvent.upsert).not.toHaveBeenCalled();
  });

  it('keeps fetching ticket details free of read-recording side effects', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: user.id,
    });
    vi.spyOn(policy, 'canAssign').mockResolvedValue(false);
    vi.spyOn(policy, 'canClose').mockResolvedValue(false);
    await service.get(user, 'ticket');
    expect(prisma.ticketEvent.upsert).not.toHaveBeenCalled();
  });

  it('atomically keeps the first server timestamp for each ticket and reader', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: user.id,
    });
    const recorded = new Map<string, { createdAt: Date }>();
    prisma.ticketEvent.upsert.mockImplementation(
      ({ where, create, update }) => {
        expect(update).toEqual({});
        expect(create).toMatchObject({ ticketId: 'ticket', type: 'READ' });
        expect(create).not.toHaveProperty('createdAt');
        if (!recorded.has(where.id)) recorded.set(where.id, { createdAt });
        return recorded.get(where.id);
      },
    );
    const first = await service.recordRead(user, 'ticket');
    expect(await service.recordRead(user, 'ticket')).toEqual(first);
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: other.id,
    });
    await service.recordRead({ ...other, globalRole: 'EMPLOYEE' }, 'ticket');
    expect(recorded.size).toBe(2);
    expect(prisma.ticketEvent.upsert.mock.calls[0]?.[0].create.actorId).toBe(
      user.id,
    );
  });

  it('returns the winning first read if concurrent inserts collide', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: user.id,
    });
    prisma.ticketEvent.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Concurrent insert', {
        code: 'P2002',
        clientVersion: '6.19.0',
      }),
    );
    prisma.ticketEvent.findUniqueOrThrow.mockResolvedValue({ createdAt });
    expect(await service.recordRead(user, 'ticket')).toEqual({ createdAt });
    expect(
      prisma.ticketEvent.findUniqueOrThrow.mock.calls[0]?.[0].where,
    ).toEqual(prisma.ticketEvent.upsert.mock.calls[0]?.[0].where);
  });

  it('surfaces storage failures so the displayed detail can offer a retry', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: user.id,
    });
    const failure = new Error('Storage unavailable');
    prisma.ticketEvent.upsert.mockRejectedValue(failure);
    await expect(service.recordRead(user, 'ticket')).rejects.toBe(failure);
    expect(prisma.ticketEvent.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it.each(['requester', 'assignee', 'lead', 'member', 'admin', 'management'])(
    'uses existing %s visibility for reports',
    async (role) => {
      if (role === 'lead')
        prisma.area.findMany.mockResolvedValue([{ id: 'led', path: '/led/' }]);
      if (role === 'member')
        prisma.areaMembership.findMany.mockResolvedValue([
          { areaId: 'member', area: { path: '/member/' } },
        ]);
      await service.audit({
        ...user,
        globalRole:
          role === 'admin'
            ? 'ADMIN'
            : role === 'management'
              ? 'MANAGEMENT'
              : role === 'lead'
                ? 'AREA_LEAD'
                : 'EMPLOYEE',
      });
      expect(prisma.ticket.findMany.mock.calls[0]?.[0].where).toEqual(
        role === 'admin' || role === 'management'
          ? {}
          : role === 'lead'
            ? {
                OR: [
                  { requesterId: user.id },
                  { assigneeId: user.id },
                  { areaId: { in: ['led'] } },
                ],
              }
            : {
                OR: [
                  { requesterId: user.id },
                  { assigneeId: user.id },
                  {
                    AND: [
                      {
                        areaId: {
                          in: role === 'member' ? ['member'] : [],
                        },
                      },
                      { assigneeId: null },
                    ],
                  },
                ],
              },
      );
    },
  );

  it('keeps first milestones across reopenings and averages each actor once per ticket', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        ...ticket,
        events: [
          event('READ', 'Viewed ticket detail', 1),
          event('READ', 'Viewed ticket detail', 2),
          event('READ', 'Viewed ticket detail', 3, {
            ...other,
            globalRole: 'EMPLOYEE',
          }),
          event('STATUS_CHANGED', 'Status OPEN → IN_PROGRESS', 4),
          event('STATUS_CHANGED', 'Status IN_PROGRESS → IN_PROGRESS', 5),
          event('STATUS_CHANGED', 'Status IN_PROGRESS → RESOLVED', 6),
          event('STATUS_CHANGED', 'Status RESOLVED → OPEN', 7),
          event('STATUS_CHANGED', 'Status OPEN → IN_PROGRESS', 8),
          event('STATUS_CHANGED', 'Status IN_PROGRESS → RESOLVED', 9),
        ],
      },
      {
        ...ticket,
        id: 'second',
        events: [event('READ', 'Viewed ticket detail', 5)],
      },
      { ...ticket, id: 'historical', status: 'RESOLVED', events: [] },
    ]);
    const report = await service.audit(user);
    expect(report.tickets[0]).toMatchObject({
      firstRead: { elapsedMs: 60_000, actor: { id: user.id } },
      firstStarted: { elapsedMs: 240_000 },
      firstResolved: { elapsedMs: 360_000 },
    });
    expect(report.tickets[2]).toMatchObject({
      firstRead: null,
      firstStarted: null,
      firstResolved: null,
    });
    expect(
      report.people.find((person) => person.actor.id === user.id),
    ).toMatchObject({
      read: { count: 2, averageMs: 180_000 },
      started: { count: 1, averageMs: 240_000 },
      resolved: { count: 1, averageMs: 360_000 },
    });
    expect(
      report.people.find((person) => person.actor.id === other.id),
    ).toMatchObject({
      read: { count: 1, averageMs: 180_000 },
      started: { count: 0, averageMs: null },
    });
  });

  it('does not infer transitions from current status, comments, or no-op status events', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        ...ticket,
        status: 'RESOLVED',
        events: [
          event('COMMENTED', 'Status OPEN → RESOLVED', 1),
          event('STATUS_CHANGED', 'Status RESOLVED → RESOLVED', 2),
          event('STATUS_CHANGED', 'Status IN_PROGRESS → IN_PROGRESS', 3),
        ],
      },
    ]);
    const report = await service.audit(user);
    expect(report.tickets[0]).toMatchObject({
      firstRead: null,
      firstStarted: null,
      firstResolved: null,
    });
    expect(report.people).toEqual([]);
  });

  it('returns an empty report when no tickets are visible', async () => {
    expect(await service.audit(user)).toEqual({ tickets: [], people: [] });
  });

  it('aggregates total, status, priority, operational SLA, and open area KPIs for tracking charts', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        ...ticket,
        id: 't1',
        status: 'OPEN',
        priority: 'URGENT',
        requesterId: user.id,
        assigneeId: null,
        dueAt: new Date(Date.now() - 60_000),
      },
      {
        ...ticket,
        id: 't2',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assigneeId: user.id,
        dueAt: new Date(Date.now() + 3_600_000),
      },
      {
        ...ticket,
        id: 't3',
        status: 'CLOSED',
        priority: 'LOW',
        assigneeId: user.id,
        dueAt: new Date(Date.now() - 60_000),
      },
    ]);
    const kpis = await service.kpis(user);
    expect(kpis).toEqual({
      total: 3,
      open: 2,
      overdue: 1,
      dueSoon: 1,
      unassigned: 1,
      criticalOpen: 2,
      slaCompliancePct: 67,
      resolutionRatePct: 33,
      mine: 3,
      byArea: [
        {
          areaId: 'area',
          name: 'Support',
          open: 2,
          unassigned: 1,
          overdue: 1,
          critical: 2,
        },
      ],
      byStatus: { OPEN: 1, IN_PROGRESS: 1, CLOSED: 1 },
      byPriority: { URGENT: 1, HIGH: 1, LOW: 1 },
      recentEvents: [],
    });
  });

  it('toggles ticket watching state', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: user.id,
    });

    // When not watching -> adds watcher
    prisma.ticketWatcher.findUnique.mockResolvedValue(null);
    prisma.ticketWatcher.create.mockResolvedValue({ id: 'w1', ticketId: 'ticket', userId: user.id });

    const res1 = await service.toggleWatch(user, 'ticket');
    expect(res1).toEqual({ watching: true });
    expect(prisma.ticketWatcher.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket', userId: user.id },
    });

    // When already watching -> removes watcher
    prisma.ticketWatcher.findUnique.mockResolvedValue({ id: 'w1' });
    prisma.ticketWatcher.delete.mockResolvedValue({});

    const res2 = await service.toggleWatch(user, 'ticket');
    expect(res2).toEqual({ watching: false });
    expect(prisma.ticketWatcher.delete).toHaveBeenCalledWith({
      where: { ticketId_userId: { ticketId: 'ticket', userId: user.id } },
    });
  });

  it('adds and verifies attachments', async () => {
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      requesterId: user.id,
      area: { id: 'area', name: 'Support', path: '/area/' },
    });

    const filePayload = {
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test content'),
    };

    prisma.attachment.create.mockResolvedValue({
      id: 'att-1',
      ticketId: 'ticket',
      filename: 'report.pdf',
      sizeBytes: 1024,
      mimeType: 'application/pdf',
      storagePath: 'test-path',
      uploader: user,
    });

    const res = await service.addAttachment(user, 'ticket', filePayload);
    expect(res.id).toBe('att-1');
    expect(prisma.attachment.create).toHaveBeenCalled();
    expect(prisma.ticketEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'COMMENTED',
          message: expect.stringContaining('Attached file: report.pdf'),
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ticket.attachment.upload',
        result: 'SUCCESS',
      }),
    );
  });
});
