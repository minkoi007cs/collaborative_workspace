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
import { ActivityType, TaskPriority } from '@prisma/client';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { ActivityService } from '../activity/activity.service';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
import { RealtimePublisher } from '../realtime/realtime.publisher';
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
  constructor(
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

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
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const task = await this.tasks.create(
      auth,
      boardId,
      parse(createSchema, body),
    );
    await this.activity.recordTask(
      auth,
      boardId,
      task.id,
      ActivityType.TASK_CREATED,
      { title: task.title, columnId: task.columnId },
    );
    await this.realtime.publishTaskForIdentity('task.created', task, auth);
    return task;
  }
}

@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get(':taskId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.get(identity(request), taskId);
  }

  @Patch(':taskId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const task = await this.tasks.update(
      auth,
      taskId,
      parse(updateSchema, body),
    );
    await this.activity.recordTask(
      auth,
      task.boardId,
      task.id,
      ActivityType.TASK_UPDATED,
      { title: task.title, version: task.version },
    );
    await this.realtime.publishTaskForIdentity('task.updated', task, auth);
    return task;
  }

  @Post(':taskId/move')
  async move(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const before = await this.tasks.get(auth, taskId);
    const task = await this.tasks.move(auth, taskId, parse(moveSchema, body));
    await this.activity.recordTask(
      auth,
      task.boardId,
      task.id,
      ActivityType.TASK_MOVED,
      {
        title: task.title,
        fromColumnId: before.columnId,
        toColumnId: task.columnId,
      },
    );
    await this.realtime.publishTaskForIdentity('task.moved', task, auth);
    return task;
  }

  @Post(':taskId/copy')
  async copy(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    const auth = identity(request);
    const task = await this.tasks.copy(auth, taskId);
    await this.activity.recordTask(
      auth,
      task.boardId,
      task.id,
      ActivityType.TASK_CREATED,
      { title: task.title, copiedFrom: taskId },
    );
    await this.realtime.publishTaskForIdentity('task.created', task, auth);
    return task;
  }

  @Put(':taskId/assignees')
  async assignees(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const result = await this.tasks.setAssignees(
      auth,
      taskId,
      parse(assigneeSchema, body),
    );
    const task = result.task;
    await this.activity.recordTask(
      auth,
      task.boardId,
      task.id,
      ActivityType.TASK_ASSIGNED,
      { title: task.title, assigneeCount: task.assignees.length },
    );
    await this.realtime.publishTaskForIdentity('task.updated', task, auth);
    this.realtime.publishNotificationCreated(
      result.recipientIds,
      'ASSIGNMENT',
      task.id,
      task.id,
    );
    return task;
  }

  @Put(':taskId/labels')
  async labels(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const task = await this.tasks.setLabels(
      auth,
      taskId,
      parse(labelsSchema, body),
    );
    await this.activity.recordTask(
      auth,
      task.boardId,
      task.id,
      ActivityType.TASK_LABELS_CHANGED,
      { title: task.title, labelCount: task.labels.length },
    );
    await this.realtime.publishTaskForIdentity('task.updated', task, auth);
    return task;
  }

  @Delete(':taskId')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const before = await this.tasks.get(auth, taskId);
    const result = await this.tasks.archive(
      auth,
      taskId,
      parse(archiveSchema, body).expectedVersion,
    );
    await this.activity.recordTask(
      auth,
      before.boardId,
      taskId,
      ActivityType.TASK_ARCHIVED,
      { title: before.title },
    );
    await this.realtime.publishTaskForIdentity(
      'task.deleted',
      { id: taskId, boardId: before.boardId, version: before.version + 1 },
      auth,
    );
    this.realtime.evictTask(taskId);
    return result;
  }

  @Delete(':taskId/permanent')
  async deletePermanent(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const before = await this.tasks.get(auth, taskId);
    const result = await this.tasks.deletePermanent(
      auth,
      taskId,
      parse(archiveSchema, body).expectedVersion,
    );
    await this.activity.recordTask(
      auth,
      before.boardId,
      taskId,
      ActivityType.TASK_DELETED,
      { title: before.title },
    );
    await this.realtime.publishTaskForIdentity(
      'task.deleted',
      { id: taskId, boardId: before.boardId, version: before.version + 1 },
      auth,
    );
    this.realtime.evictTask(taskId);
    return result;
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
