import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthUser } from '../auth/auth.types.js';
import { PolicyService } from '../auth/policy.service.js';
import { getRoleRank } from '../auth/roles.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto, UpdateUserDto } from './users.schemas.js';

const publicUser = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  globalRole: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
  ) {}

  list(user: AuthUser) {
    const where = this.policy.userWhere(user);
    return this.prisma.user.findMany({
      where,
      select: publicUser,
      orderBy: { name: 'asc' },
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const targetRank = getRoleRank(dto.globalRole ?? 'EMPLOYEE');
    if (!this.policy.canManageUser(actor, targetRank)) {
      throw new ForbiddenException('Cannot create user with rank equal or higher than yours');
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash: await argon2.hash(dto.password),
        globalRole: dto.globalRole ?? 'EMPLOYEE',
      },
      select: publicUser,
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    const targetRank = getRoleRank(target.globalRole);
    if (!this.policy.canManageUser(actor, targetRank) && actor.id !== id) {
      throw new ForbiddenException('Cannot edit user with rank equal or higher than yours');
    }

    // Role elevation or change check
    if (dto.globalRole && dto.globalRole !== target.globalRole) {
      const newRank = getRoleRank(dto.globalRole);
      if (!this.policy.canManageUser(actor, newRank)) {
        throw new ForbiddenException('Cannot assign a role with rank equal or higher than yours');
      }
    }

    // Prevent deactivating or demoting the last active ADMIN
    if (
      target.globalRole === 'ADMIN' &&
      ((dto.isActive === false) || (dto.globalRole && dto.globalRole !== 'ADMIN'))
    ) {
      const adminCount = await this.prisma.user.count({
        where: { globalRole: 'ADMIN', isActive: true },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote or deactivate the last active ADMIN');
      }
    }

    // If password or role or isActive changes, increment tokenVersion to revoke sessions
    const shouldRevoke =
      !!dto.password ||
      (dto.globalRole && dto.globalRole !== target.globalRole) ||
      (dto.isActive !== undefined && dto.isActive !== target.isActive);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        globalRole: dto.globalRole,
        passwordHash: dto.password ? await argon2.hash(dto.password) : undefined,
        tokenVersion: shouldRevoke ? { increment: 1 } : undefined,
      },
      select: publicUser,
    });
  }
}
