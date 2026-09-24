import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { z } from 'zod';
import { ActivityService } from '../activity/activity.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { CommentsService } from './comments.service';

const contentSchema = z
  .object({ content: z.string().trim().min(1).max(4000) })
  .strict();
const updateSchema = contentSchema.extend({
  expectedVersion: z.number().int().positive(),
});
const deleteSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
function parse<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}
function identity(request: AuthenticatedRequest): AuthIdentity {
  if (!request.auth) throw new Error('AuthGuard did not attach identity');
  return request.auth;
}

@Controller('tasks/:taskId/comments')
@UseGuards(AuthGuard)
export class TaskCommentsController {
  constructor(
    @Inject(CommentsService) private readonly comments: CommentsService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('cursor') cursor?: string,
  ) {
    if (cursor && !z.string().uuid().safeParse(cursor).success)
      throw new BadRequestException('Invalid cursor');
    return this.comments.list(identity(request), taskId, cursor);
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const result = await this.comments.create(
      identity(request),
      taskId,
      parse(contentSchema, body).content,
    );
    await this.activity.recordComment(
      identity(request),
      result.boardId,
      taskId,
      result.comment.id,
      ActivityType.COMMENT_CREATED,
    );
    this.realtime.publishComment(
      'comment.created',
      result.comment,
      result.boardId,
    );
    this.realtime.publishMentions(
      result.recipientIds,
      result.comment.id,
      taskId,
    );
    this.realtime.publishNotificationCreated(
      result.commentRecipientIds,
      'COMMENT',
      result.comment.id,
      taskId,
    );
    return result.comment;
  }
}

@Controller('comments')
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(
    @Inject(CommentsService) private readonly comments: CommentsService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Patch(':commentId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateSchema, body);
    const result = await this.comments.update(
      identity(request),
      commentId,
      input.content,
      input.expectedVersion,
    );
    await this.activity.recordComment(
      identity(request),
      result.boardId,
      result.comment.taskId,
      commentId,
      ActivityType.COMMENT_UPDATED,
    );
    this.realtime.publishComment(
      'comment.updated',
      result.comment,
      result.boardId,
    );
    this.realtime.publishMentions(
      result.recipientIds,
      result.comment.id,
      result.comment.taskId,
    );
    return result.comment;
  }

  @Delete(':commentId')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: unknown,
  ) {
    const result = await this.comments.remove(
      identity(request),
      commentId,
      parse(deleteSchema, body).expectedVersion,
    );
    await this.activity.recordComment(
      identity(request),
      result.boardId,
      result.taskId,
      commentId,
      ActivityType.COMMENT_DELETED,
    );
    this.realtime.publishComment(
      'comment.deleted',
      {
        id: result.id,
        taskId: result.taskId,
        version: result.version,
        author: result.author,
      },
      result.boardId,
    );
    return { deleted: true };
  }
}
