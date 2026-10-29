import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthProfile, AuthUser } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  cookieName() {
    return this.config.get<string>('COOKIE_NAME', 'cw_session');
  }

  async login(email: string, password: string, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = await this.jwt.signAsync({ sub: user.id });
    this.setCookie(res, token);
    return this.profileFor({
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
    });
  }

  logout(res: Response) {
    res.clearCookie(this.cookieName(), { path: '/' });
    return { ok: true };
  }

  async profileFor(user: AuthUser): Promise<AuthProfile> {
    const [ledAreas, memberships] = await Promise.all([
      this.prisma.area.findMany({
        where: { leadUserId: user.id },
        select: { id: true },
      }),
      this.prisma.areaMembership.findMany({
        where: { userId: user.id },
        include: { area: { select: { name: true } } },
      }),
    ]);

    return {
      ...user,
      leadAreaIds: ledAreas.map((area) => area.id),
      memberships: memberships.map((membership) => ({
        areaId: membership.areaId,
        areaName: membership.area.name,
        canAssign: membership.canAssign,
        canClose: membership.canClose,
      })),
    };
  }

  private setCookie(res: Response, token: string) {
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
