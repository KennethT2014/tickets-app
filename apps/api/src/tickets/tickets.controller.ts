import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { TicketStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import {
  assignTicketSchema,
  commentTicketSchema,
  createTicketSchema,
  statusTicketSchema,
  updateTicketSchema,
  type AssignTicketDto,
  type CommentTicketDto,
  type CreateTicketDto,
  type StatusTicketDto,
  type UpdateTicketDto,
} from './tickets.schemas.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: TicketStatus,
    @Query('areaId') areaId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
  ) {
    return this.tickets.list(user, { status, areaId, assigneeId, q, mine });
  }

  @Get('kpis')
  kpis(@CurrentUser() user: AuthUser) {
    return this.tickets.kpis(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tickets.get(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTicketSchema)) dto: CreateTicketDto,
  ) {
    return this.tickets.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) dto: UpdateTicketDto,
  ) {
    return this.tickets.update(user, id, dto);
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignTicketSchema)) dto: AssignTicketDto,
  ) {
    return this.tickets.assign(user, id, dto);
  }

  @Post(':id/status')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(statusTicketSchema)) dto: StatusTicketDto,
  ) {
    return this.tickets.changeStatus(user, id, dto);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(commentTicketSchema)) dto: CommentTicketDto,
  ) {
    return this.tickets.comment(user, id, dto);
  }
}
