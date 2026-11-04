import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types.js';
import { PolicyService } from '../auth/policy.service.js';
import { getRoleRank } from '../auth/roles.js';
import { slugify } from '../common/slug.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateAreaDto,
  PatchMemberDto,
  UpdateAreaDto,
  UpsertMemberDto,
} from './org.schemas.js';

export type OrgTreeNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  path: string;
  depth: number;
  lead: { id: string; name: string; email: string } | null;
  members: {
    userId: string;
    name: string;
    email: string;
    canAssign: boolean;
    canClose: boolean;
  }[];
  children: OrgTreeNode[];
};

const memberInclude = {
  user: { select: { id: true, name: true, email: true, globalRole: true } },
} as const;

@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
  ) {}

  async tree(user: AuthUser): Promise<OrgTreeNode[]> {
    const isEmployee = user.globalRole === 'EMPLOYEE';
    const scopePaths = await this.policy.getScopeAreaPaths(user);

    const [areas, memberships] = await Promise.all([
      this.prisma.area.findMany({
        include: {
          lead: { select: { id: true, name: true, email: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.areaMembership.findMany({ include: memberInclude }),
    ]);

    const membersByArea = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      const list = membersByArea.get(membership.areaId) ?? [];
      list.push(membership);
      membersByArea.set(membership.areaId, list);
    }

    const nodes = new Map<string, OrgTreeNode>();
    for (const area of areas) {
      // Employees do NOT see membership details across areas to prevent privilege enumeration
      const areaMembers = isEmployee
        ? []
        : (membersByArea.get(area.id) ?? []).map((membership) => ({
            userId: membership.userId,
            name: membership.user.name,
            email: membership.user.email,
            canAssign: membership.canAssign,
            canClose: membership.canClose,
          }));

      nodes.set(area.id, {
        id: area.id,
        name: area.name,
        slug: area.slug,
        parentId: area.parentId,
        path: area.path,
        depth: area.depth,
        lead: isEmployee ? null : area.lead,
        members: areaMembers,
        children: [],
      });
    }

    const roots: OrgTreeNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // If company-wide or EMPLOYEE (who sees entire tree structure for destination picking), return all
    if (!scopePaths || isEmployee) {
      return roots;
    }

    // AREA_LEAD: filter roots or subtree branches that match scopePaths
    const filterSubtree = (nodeList: OrgTreeNode[]): OrgTreeNode[] => {
      const result: OrgTreeNode[] = [];
      for (const node of nodeList) {
        const inScope = scopePaths.some(
          (sp) => node.path.startsWith(sp) || sp.startsWith(node.path),
        );
        if (inScope) {
          result.push({
            ...node,
            children: filterSubtree(node.children),
          });
        }
      }
      return result;
    };

    return filterSubtree(roots);
  }

  async create(user: AuthUser, dto: CreateAreaDto) {
    if (!this.policy.isAdmin(user)) {
      throw new ForbiddenException();
    }

    let parentPath = '/';
    let parentDepth = 0;
    if (dto.parentId) {
      const parent = await this.prisma.area.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent area not found');
      parentPath = parent.path;
      parentDepth = parent.depth + 1;
    }

    const id = randomUUID();
    const path = `${parentPath}${id}/`;

    return this.prisma.area.create({
      data: {
        id,
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        parentId: dto.parentId ?? null,
        leadUserId: dto.leadUserId ?? null,
        path,
        depth: parentDepth,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateAreaDto) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Area not found');
    if (!this.policy.isAdmin(user)) {
      throw new ForbiddenException();
    }
    if (dto.parentId === id) {
      throw new BadRequestException('An area cannot be its own parent');
    }

    // Prevent cyclic parent assignments
    if (dto.parentId) {
      const newParent = await this.prisma.area.findUnique({
        where: { id: dto.parentId },
      });
      if (!newParent)
        throw new NotFoundException('Target parent area not found');
      if (newParent.path.startsWith(area.path)) {
        throw new BadRequestException(
          'Cannot move an area into its own descendant (cycle detected)',
        );
      }
    }

    // Resolve through the root connection before the write transaction owns libSQL.
    const renamedSlug = dto.name
      ? await this.uniqueSlug(dto.name, id)
      : undefined;
    let newPath = area.path;
    let newDepth = area.depth;

    if (dto.parentId !== undefined && dto.parentId !== area.parentId) {
      if (dto.parentId === null) {
        newPath = `/${id}/`;
        newDepth = 0;
      } else {
        const parent = await this.prisma.area.findUniqueOrThrow({
          where: { id: dto.parentId },
        });
        newPath = `${parent.path}${id}/`;
        newDepth = parent.depth + 1;
      }

      // Re-path descendants recursively in a transaction
      const oldPath = area.path;
      return this.prisma.$transaction(async (tx) => {
        const updatedSelf = await tx.area.update({
          where: { id },
          data: {
            name: dto.name,
            slug: renamedSlug,
            parentId: dto.parentId,
            leadUserId:
              dto.leadUserId === undefined ? undefined : dto.leadUserId,
            path: newPath,
            depth: newDepth,
          },
        });

        // Find descendants
        const descendants = await tx.area.findMany({
          where: { path: { startsWith: oldPath }, id: { not: id } },
        });

        for (const desc of descendants) {
          const subSuffix = desc.path.slice(oldPath.length);
          const subPath = `${newPath}${subSuffix}`;
          const subDepth = subPath.split('/').filter(Boolean).length - 1;
          await tx.area.update({
            where: { id: desc.id },
            data: { path: subPath, depth: subDepth },
          });
        }

        return updatedSelf;
      });
    }

    return this.prisma.area.update({
      where: { id },
      data: {
        name: dto.name,
        slug: renamedSlug,
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
        leadUserId: dto.leadUserId === undefined ? undefined : dto.leadUserId,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    if (!this.policy.isAdmin(user)) throw new ForbiddenException();
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { _count: { select: { tickets: true, children: true } } },
    });
    if (!area) throw new NotFoundException('Area not found');
    if (area._count.tickets > 0) {
      throw new BadRequestException(
        'Cannot delete an area that still has tickets',
      );
    }
    if (area._count.children > 0) {
      throw new BadRequestException('Move or delete child areas first');
    }
    await this.prisma.area.delete({ where: { id } });
    return { ok: true };
  }

  async upsertMember(user: AuthUser, areaId: string, dto: UpsertMemberDto) {
    if (!(await this.policy.canManageArea(user, areaId))) {
      throw new ForbiddenException();
    }
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Area not found');

    // Rank enforcement: actor cannot assign privileges to or manage members with rank >= actor's rank
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const targetRank = getRoleRank(targetUser.globalRole);
    if (
      !this.policy.canManageUser(user, targetRank) &&
      user.id !== targetUser.id
    ) {
      throw new ForbiddenException(
        'Cannot manage area membership for user with equal or higher rank',
      );
    }

    return this.prisma.areaMembership.upsert({
      where: { userId_areaId: { userId: dto.userId, areaId } },
      create: {
        userId: dto.userId,
        areaId,
        canAssign: dto.canAssign ?? false,
        canClose: dto.canClose ?? false,
      },
      update: {
        canAssign: dto.canAssign,
        canClose: dto.canClose,
      },
      include: memberInclude,
    });
  }

  async patchMember(
    user: AuthUser,
    areaId: string,
    userId: string,
    dto: PatchMemberDto,
  ) {
    if (!(await this.policy.canManageArea(user, areaId))) {
      throw new ForbiddenException();
    }
    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId, areaId } },
      include: { user: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const targetRank = getRoleRank(membership.user.globalRole);
    if (!this.policy.canManageUser(user, targetRank) && user.id !== userId) {
      throw new ForbiddenException(
        'Cannot modify membership for user with equal or higher rank',
      );
    }

    return this.prisma.areaMembership.update({
      where: { id: membership.id },
      data: dto,
      include: memberInclude,
    });
  }

  async removeMember(user: AuthUser, areaId: string, userId: string) {
    if (!(await this.policy.canManageArea(user, areaId))) {
      throw new ForbiddenException();
    }
    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId, areaId } },
      include: { user: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const targetRank = getRoleRank(membership.user.globalRole);
    if (!this.policy.canManageUser(user, targetRank) && user.id !== userId) {
      throw new ForbiddenException(
        'Cannot remove membership for user with equal or higher rank',
      );
    }

    await this.prisma.areaMembership.delete({
      where: { userId_areaId: { userId, areaId } },
    });
    return { ok: true };
  }

  async listQuickReplies(user: AuthUser, areaId: string) {
    return this.prisma.quickReply.findMany({
      where: { areaId },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id: true, name: true } } },
    });
  }

  async createQuickReply(
    user: AuthUser,
    areaId: string,
    title: string,
    body: string,
  ) {
    if (!(await this.policy.canAssign(user, areaId))) {
      throw new ForbiddenException(
        'Only department members can manage quick replies',
      );
    }
    return this.prisma.quickReply.create({
      data: {
        areaId,
        title,
        body,
        createdById: user.id,
      },
    });
  }

  async deleteQuickReply(user: AuthUser, id: string) {
    const qr = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!qr) throw new NotFoundException('Quick reply not found');
    if (!(await this.policy.canAssign(user, qr.areaId))) {
      throw new ForbiddenException();
    }
    await this.prisma.quickReply.delete({ where: { id } });
    return { ok: true };
  }

  private async uniqueSlug(name: string, ignoreId?: string) {
    const base = slugify(name) || 'area';
    let slug = base;
    let i = 2;
    while (true) {
      const existing = await this.prisma.area.findUnique({ where: { slug } });
      if (!existing || existing.id === ignoreId) return slug;
      slug = `${base}-${i++}`;
    }
  }
}
