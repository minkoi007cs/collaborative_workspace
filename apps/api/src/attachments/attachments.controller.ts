import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AttachmentsService } from './attachments.service';
import { allowedAttachmentTypes, maxAttachmentSize } from './storage.service';

const uploadSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (name) =>
          !name.includes('/') &&
          !name.includes('\\') &&
          !Array.from(name).some(
            (character) =>
              character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ),
      ),
    contentType: z.enum(allowedAttachmentTypes),
    size: z.number().int().min(1).max(maxAttachmentSize),
  })
  .strict();

function auth(request: AuthenticatedRequest) {
  if (!request.auth) throw new Error('AuthGuard did not attach identity');
  return request.auth;
}

@Controller()
@UseGuards(AuthGuard)
export class AttachmentsController {
  constructor(
    @Inject(AttachmentsService)
    private readonly attachments: AttachmentsService,
  ) {}

  @Get('tasks/:taskId/attachments')
  list(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.attachments.list(auth(request), taskId);
  }

  @Post('tasks/:taskId/attachments/upload-url')
  requestUpload(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid attachment');
    response.setHeader('Cache-Control', 'private, no-store');
    return this.attachments.requestUpload(auth(request), taskId, parsed.data);
  }

  @Post('tasks/:taskId/attachments/:attachmentId/finalize')
  finalize(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachments.finalize(auth(request), taskId, attachmentId);
  }

  @Get('attachments/:attachmentId/download-url')
  download(
    @Req() request: AuthenticatedRequest,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.attachments.download(auth(request), attachmentId);
  }

  @Delete('attachments/:attachmentId')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachments.remove(auth(request), attachmentId);
  }
}
