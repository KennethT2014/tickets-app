import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from './auth.types.js';
import type { GlobalRole } from './roles.js';
import { getRoleRank, isAdminRole, isCompanyWideRole } from './roles.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser): boolean {
    return isAdminRole(user.globalRole);
  }

  isCompanyWide(user: AuthUser): boolean {
    return isCompanyWideRole(user.globalRole);
  }

  getUserRank(user: AuthUser): number {
    return getRoleRank(user.globalRole);
  }

  /**
   * Returns materialized path prefixes of areas the user has leadership/management access to.
   * If the user is ADMIN or MANAGEMENT, returns null (meaning company-wide/unrestricted).
   */
  async getScopeAreaPaths(user: AuthUser): Promise<string[] | null> {
    if (this.isCompanyWide(user)) {
      return null;
    }

    // Areas where user is lead
    const ledAreas = await this.prisma.area.findMany({
      where: { leadUserId: user.id },
      select: { path: true },
    });

    // Areas where user has explicit membership
    const memberships = await this.prisma.areaMembership.findMany({
      where: { userId: user.id },
      include: { area: { select: { path: true } } },
    });

    const paths = new Set<string>();
    for (const a of ledAreas) {
      if (a.path) paths.add(a.path);
    }
    for (const m of memberships) {
      if (m.area?.path) paths.add(m.area.path);
    }

    return Array.from(paths);
  }

  /**
   * Returns list of area IDs in the user's scope (including descending subareas).
   * If company-wide, returns null.
   */
  async getScopedAreaIds(user: AuthUser): Promise<string[] | null> {
    const paths = await this.getScopeAreaPaths(user);
    if (!paths) return null; // company-wide
    if (paths.length === 0) return [];

    const conditions = paths.map((p) => ({ path: { startsWith: p } }));
    const areas = await this.prisma.area.findMany({
      where: { OR: conditions },
      select: { id: true },
    });

    return areas.map((a) => a.id);
  }

  /**
   * Prisma where filter for tickets visible to the user:
   * - ADMIN / MANAGEMENT: all tickets
   * - AREA_LEAD: tickets in their area or subareas, OR where requester/assignee
   * - EMPLOYEE: tickets where requester or assignee, OR (unassigned tickets in their direct membership areas)
   */
  async ticketWhere(user: AuthUser): Promise<Prisma.TicketWhereInput> {
    if (this.isCompanyWide(user)) {
      return {};
    }

    if (user.globalRole === 'AREA_LEAD') {
      const areaIds = (await this.getScopedAreaIds(user)) ?? [];
      return {
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id },
          { areaId: { in: areaIds } },
        ],
      };
    }

    // EMPLOYEE: per Q1, sees own tickets + unassigned tickets in areas where they are member
    const memberships = await this.prisma.areaMembership.findMany({
      where: { userId: user.id },
      select: { areaId: true },
    });
    const memberAreaIds = memberships.map((m) => m.areaId);

    return {
      OR: [
        { requesterId: user.id },
        { assigneeId: user.id },
        {
          AND: [
            { areaId: { in: memberAreaIds } },
            { assigneeId: null },
          ],
        },
      ],
    };
  }

  /**
   * Checks if user can view a specific ticket.
   */
  async canViewTicket(
    user: AuthUser,
    ticket: { requesterId: string; assigneeId: string | null; areaId: string },
  ): Promise<boolean> {
    if (this.isCompanyWide(user)) return true;
    if (ticket.requesterId === user.id || ticket.assigneeId === user.id) return true;

    if (user.globalRole === 'AREA_LEAD') {
      const areaIds = await this.getScopedAreaIds(user);
      return areaIds?.includes(ticket.areaId) ?? false;
    }

    // EMPLOYEE: can see if unassigned in their member area
    if (!ticket.assigneeId) {
      const membership = await this.prisma.areaMembership.findUnique({
        where: { userId_areaId: { userId: user.id, areaId: ticket.areaId } },
      });
      return !!membership;
    }

    return false;
  }

  /**
   * Determines if user can manage an area (modify, lead, members).
   */
  async canManageArea(user: AuthUser, areaId: string): Promise<boolean> {
    if (this.isCompanyWide(user)) return true;

    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) return false;

    // Direct lead
    if (area.leadUserId === user.id) return true;

    // Check if user is lead of an ancestor area (hierarchical inheritance)
    const ledAncestors = await this.prisma.area.findMany({
      where: { leadUserId: user.id },
      select: { path: true },
    });

    for (const anc of ledAncestors) {
      if (area.path.startsWith(anc.path)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines if user can assign tickets in a given area.
   */
  async canAssign(user: AuthUser, areaId: string): Promise<boolean> {
    if (await this.canManageArea(user, areaId)) return true;
    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId: user.id, areaId } },
    });
    return membership?.canAssign === true;
  }

  /**
   * Determines if user can close tickets in a given area.
   * Enforces Segregation of Duties: a requester CANNOT close their own ticket (unless ADMIN as documented exception).
   */
  async canClose(user: AuthUser, areaId: string, requesterId?: string): Promise<boolean> {
    if (requesterId && requesterId === user.id && !this.isAdmin(user)) {
      return false; // SoD: requester cannot close their own ticket
    }

    if (await this.canManageArea(user, areaId)) return true;

    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId: user.id, areaId } },
    });
    return membership?.canClose === true;
  }

  /**
   * Prisma where filter for user directory visibility:
   * A user can only see persons with rank <= their own rank.
   */
  userWhere(user: AuthUser): Prisma.UserWhereInput {
    const userRank = this.getUserRank(user);
    if (userRank >= 4) {
      return {}; // ADMIN sees everyone
    }

    // Role rank filtering:
    // MANAGEMENT (3): sees MANAGEMENT, AREA_LEAD, EMPLOYEE (rank <= 3)
    // AREA_LEAD (2): sees AREA_LEAD, EMPLOYEE (rank <= 2)
    // EMPLOYEE (1): sees EMPLOYEE (rank <= 1)
    const allowedRoles: GlobalRole[] = [];
    if (userRank >= 3) allowedRoles.push('MANAGEMENT');
    if (userRank >= 2) allowedRoles.push('AREA_LEAD');
    if (userRank >= 1) allowedRoles.push('EMPLOYEE');

    return {
      globalRole: { in: allowedRoles },
    };
  }

  /**
   * Validates if actor can manage target user (edit, deactivate, assign role).
   * Actor must have rank strictly greater than target user.
   */
  canManageUser(actor: AuthUser, targetRank: number): boolean {
    return this.getUserRank(actor) > targetRank;
  }
}
