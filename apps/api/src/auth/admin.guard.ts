import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { isAdminRole } from './roles.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user || !isAdminRole(request.user.globalRole)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
