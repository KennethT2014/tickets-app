import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import {
  createAreaSchema,
  patchMemberSchema,
  updateAreaSchema,
  upsertMemberSchema,
  type CreateAreaDto,
  type PatchMemberDto,
  type UpdateAreaDto,
  type UpsertMemberDto,
} from './org.schemas.js';
import { OrgService } from './org.service.js';

@Controller('org')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('tree')
  tree() {
    return this.org.tree();
  }

  @Post('areas')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAreaSchema)) dto: CreateAreaDto,
  ) {
    return this.org.create(user, dto);
  }

  @Patch('areas/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAreaSchema)) dto: UpdateAreaDto,
  ) {
    return this.org.update(user, id, dto);
  }

  @Delete('areas/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.org.remove(user, id);
  }

  @Post('areas/:id/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertMemberSchema)) dto: UpsertMemberDto,
  ) {
    return this.org.upsertMember(user, id, dto);
  }

  @Patch('areas/:id/members/:userId')
  patchMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(patchMemberSchema)) dto: PatchMemberDto,
  ) {
    return this.org.patchMember(user, id, userId, dto);
  }

  @Delete('areas/:id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.org.removeMember(user, id, userId);
  }
}
