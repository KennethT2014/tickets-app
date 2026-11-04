import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MaintenanceTasksService {
  private readonly logger = new Logger(MaintenanceTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Daily check: Autocloses tickets in RESOLVED status for more than 5 days.
   * Analogue to Znuny's pending auto close.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutoCloseResolved() {
    this.logger.log('Running auto-close for resolved tickets...');
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const staleResolved = await this.prisma.ticket.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { lte: fiveDaysAgo },
      },
      include: { area: true },
    });

    for (const ticket of staleResolved) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      });

      await this.prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: ticket.requesterId, // System event attributed to ticket lifecycle
          type: 'CLOSED',
          fromStatus: 'RESOLVED',
          toStatus: 'CLOSED',
          message: 'Status RESOLVED → CLOSED (Auto-closed after 5 days without customer response)',
        },
      });

      await this.audit.record({
        action: 'job.ticket.autoclose',
        result: 'SUCCESS',
        entityType: 'Ticket',
        entityId: ticket.id,
        areaId: ticket.areaId,
        areaPath: ticket.area.path,
        reason: 'Auto-closed after 5 days in RESOLVED status',
      });
    }

    if (staleResolved.length > 0) {
      this.logger.log(`Auto-closed ${staleResolved.length} stale resolved tickets.`);
    }
  }

  /**
   * Hourly check: Detects WAITING tickets where waitingUntil has passed and notifies the assignee/lead.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleWaitingReminders() {
    const now = new Date();
    const expiredWaiting = await this.prisma.ticket.findMany({
      where: {
        status: 'WAITING',
        waitingUntil: { lte: now },
      },
      include: { area: true, assignee: true },
    });

    for (const ticket of expiredWaiting) {
      const recipientId = ticket.assigneeId || ticket.area.leadUserId;
      if (recipientId) {
        await this.notifications.notify({
          userId: recipientId,
          ticketId: ticket.id,
          title: `Reminder: ${ticket.number}`,
          body: `Waiting period ended for "${ticket.title}". Please follow up.`,
        });
      }
    }
  }
}
