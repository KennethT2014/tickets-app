import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TicketStatus } from '@prisma/client';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import {
  assignTicketSchema,
  commentTicketSchema,
  createTicketSchema,
  linkTicketSchema,
  statusTicketSchema,
  transferTicketSchema,
  updateTicketSchema,
  type AssignTicketDto,
  type CommentTicketDto,
  type CreateTicketDto,
  type LinkTicketDto,
  type StatusTicketDto,
  type TransferTicketDto,
  type UpdateTicketDto,
} from './tickets.schemas.js';
import { TicketsService } from './tickets.service.js';

type UploadedFilePayload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

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

  @Get('audit')
  audit(@CurrentUser() user: AuthUser) {
    return this.tickets.audit(user);
  }

  @Post(':id/read')
  recordRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tickets.recordRead(user, id);
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

  @Post(':id/claim')
  claim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tickets.assign(user, id, { assigneeId: user.id });
  }

  @Post(':id/transfer')
  transfer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transferTicketSchema)) dto: TransferTicketDto,
  ) {
    return this.tickets.transfer(user, id, dto.areaId, dto.reason);
  }

  @Post(':id/links')
  link(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(linkTicketSchema)) dto: LinkTicketDto,
  ) {
    return this.tickets.link(user, id, dto.toTicketNumberOrId, dto.type);
  }

  @Post(':id/watch')
  watch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tickets.toggleWatch(user, id);
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    }),
  )
  uploadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: UploadedFilePayload,
    @Body('commentId') commentId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.tickets.addAttachment(user, id, file, commentId);
  }

  @Get(':id/attachments/:attachmentId')
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { attachment, filePath } = await this.tickets.getAttachment(
      user,
      id,
      attachmentId,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
    });
    return new StreamableFile(createReadStream(filePath));
  }
}
