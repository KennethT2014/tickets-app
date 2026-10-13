import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return { ok: true };
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async notify(input: {
    userId: string;
    ticketId?: string;
    title: string;
    body: string;
    actorId?: string;
  }) {
    if (input.actorId && input.actorId === input.userId) return;
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        ticketId: input.ticketId,
        title: input.title,
        body: input.body,
      },
    });
  }
}
