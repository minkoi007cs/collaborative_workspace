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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TaskPriority } from '@prisma/client';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
import { TasksService } from './tasks.service';

const uuid = z.string().uuid();
const version = z.number().int().positive();
const createSchema = z
  .object({ title: z.string().trim().min(1).max(200), columnId: uuid })
  .strict();
const updateSchema = z
  .object({
    expectedVersion: version,
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    completed: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);
const moveSchema = z
  .object({
    expectedVersion: version,
    toColumnId: uuid,
    beforeTaskId: uuid.nullable().optional(),
  })
  .strict();
const assigneeSchema = z
  .object({ expectedVersion: version, userIds: z.array(uuid).max(50) })
  .strict();
const labelsSchema = z
  .object({ expectedVersion: version, labelIds: z.array(uuid).max(20) })
  .strict();
const archiveSchema = z.object({ expectedVersion: version }).strict();
const labelCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
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

@Controller('boards/:boardId/tasks')
@UseGuards(AuthGuard)
export class BoardsTasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('cursor') cursor?: string,
  ) {
    if (cursor && !uuid.safeParse(cursor).success)
      throw new BadRequestException('Invalid cursor');
    return this.tasks.list(identity(request), boardId, cursor);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.create(
      identity(request),
      boardId,
      parse(createSchema, body),
    );
  }
}

@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get(':taskId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.get(identity(request), taskId);
  }

  @Patch(':taskId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.update(
      identity(request),
      taskId,
      parse(updateSchema, body),
    );
  }

  @Post(':taskId/move')
  move(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.move(identity(request), taskId, parse(moveSchema, body));
  }

  @Post(':taskId/copy')
  copy(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.copy(identity(request), taskId);
  }

  @Put(':taskId/assignees')
  assignees(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.setAssignees(
      identity(request),
      taskId,
      parse(assigneeSchema, body),
    );
  }

  @Put(':taskId/labels')
  labels(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.setLabels(
      identity(request),
      taskId,
      parse(labelsSchema, body),
    );
  }

  @Delete(':taskId')
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.archive(
      identity(request),
      taskId,
      parse(archiveSchema, body).expectedVersion,
    );
  }

  @Delete(':taskId/permanent')
  deletePermanent(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.deletePermanent(
      identity(request),
      taskId,
      parse(archiveSchema, body).expectedVersion,
    );
  }
}

@Controller('projects/:projectId/labels')
@UseGuards(AuthGuard)
export class ProjectLabelsController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.tasks.listLabels(identity(request), projectId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.createLabel(
      identity(request),
      projectId,
      parse(labelCreateSchema, body),
    );
  }
}
