import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.types.js';
import { isAdminRole, isCompanyWideRole } from './roles.js';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser) {
    return isAdminRole(user.globalRole);
  }

  isCompanyWide(user: AuthUser) {
    return isCompanyWideRole(user.globalRole);
  }

  async canManageArea(user: AuthUser, areaId: string) {
    if (this.isCompanyWide(user)) return true;
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    return area?.leadUserId === user.id;
  }

  async canAssign(user: AuthUser, areaId: string) {
    if (await this.canManageArea(user, areaId)) return true;
    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId: user.id, areaId } },
    });
    return membership?.canAssign === true;
  }

  async canClose(user: AuthUser, areaId: string) {
    if (await this.canManageArea(user, areaId)) return true;
    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId: user.id, areaId } },
    });
    return membership?.canClose === true;
  }

  async visibleAreaIds(user: AuthUser) {
    if (this.isCompanyWide(user)) return null;
    const [led, memberships] = await Promise.all([
      this.prisma.area.findMany({
        where: { leadUserId: user.id },
        select: { id: true },
      }),
      this.prisma.areaMembership.findMany({
        where: { userId: user.id },
        select: { areaId: true },
      }),
    ]);
    return [...new Set([...led.map((a) => a.id), ...memberships.map((m) => m.areaId)])];
  }

  async canViewTicket(
    user: AuthUser,
    ticket: { requesterId: string; assigneeId: string | null; areaId: string },
  ) {
    if (this.isCompanyWide(user)) return true;
    if (ticket.requesterId === user.id || ticket.assigneeId === user.id) {
      return true;
    }
    const areaIds = await this.visibleAreaIds(user);
    return areaIds?.includes(ticket.areaId) ?? false;
  }
}
