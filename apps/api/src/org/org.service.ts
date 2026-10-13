import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessService } from '../auth/access.service.js';
import type { AuthUser } from '../auth/auth.types.js';
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
    private readonly access: AccessService,
  ) {}

  async tree(): Promise<OrgTreeNode[]> {
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
      nodes.set(area.id, {
        id: area.id,
        name: area.name,
        slug: area.slug,
        parentId: area.parentId,
        lead: area.lead,
        members: (membersByArea.get(area.id) ?? []).map((membership) => ({
          userId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          canAssign: membership.canAssign,
          canClose: membership.canClose,
        })),
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
    return roots;
  }

  async create(user: AuthUser, dto: CreateAreaDto) {
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException();
    }
    return this.prisma.area.create({
      data: {
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        parentId: dto.parentId ?? null,
        leadUserId: dto.leadUserId ?? null,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateAreaDto) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Area not found');
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException();
    }
    if (dto.parentId === id) {
      throw new BadRequestException('An area cannot be its own parent');
    }
    return this.prisma.area.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.name ? await this.uniqueSlug(dto.name, id) : undefined,
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
        leadUserId: dto.leadUserId === undefined ? undefined : dto.leadUserId,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    if (!this.access.isAdmin(user)) throw new ForbiddenException();
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { _count: { select: { tickets: true, children: true } } },
    });
    if (!area) throw new NotFoundException('Area not found');
    if (area._count.tickets > 0) {
      throw new BadRequestException('Cannot delete an area that still has tickets');
    }
    if (area._count.children > 0) {
      throw new BadRequestException('Move or delete child areas first');
    }
    await this.prisma.area.delete({ where: { id } });
    return { ok: true };
  }

  async upsertMember(user: AuthUser, areaId: string, dto: UpsertMemberDto) {
    if (!(await this.access.canManageArea(user, areaId))) {
      throw new ForbiddenException();
    }
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Area not found');
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
    if (!(await this.access.canManageArea(user, areaId))) {
      throw new ForbiddenException();
    }
    const membership = await this.prisma.areaMembership.findUnique({
      where: { userId_areaId: { userId, areaId } },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return this.prisma.areaMembership.update({
      where: { id: membership.id },
      data: dto,
      include: memberInclude,
    });
  }

  async removeMember(user: AuthUser, areaId: string, userId: string) {
    if (!(await this.access.canManageArea(user, areaId))) {
      throw new ForbiddenException();
    }
    await this.prisma.areaMembership.delete({
      where: { userId_areaId: { userId, areaId } },
    });
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
