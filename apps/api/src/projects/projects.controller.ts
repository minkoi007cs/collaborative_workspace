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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { z } from 'zod';
import { ActivityService } from '../activity/activity.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { ProjectsService } from './projects.service';

const nameSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();
const projectSchema = nameSchema.extend({
  description: z.string().trim().max(2000).nullable().optional(),
});
const projectUpdateSchema = projectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
const columnSchema = nameSchema.extend({
  expectedVersion: z.number().int().positive(),
});
const versionSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
const orderSchema = versionSchema.extend({
  columnIds: z.array(z.string().uuid()).max(20),
});

function parse<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}

function identity(request: AuthenticatedRequest): AuthIdentity {
  if (!request.auth) throw new Error('AuthGuard did not attach identity');
  return request.auth;
}

@Controller('workspaces/:workspaceId/projects')
@UseGuards(AuthGuard)
export class WorkspaceProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.projects.list(identity(request), workspaceId);
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const project = await this.projects.create(
      auth,
      workspaceId,
      parse(projectSchema, body),
    );
    await this.activity.recordProject(
      auth,
      project.id,
      ActivityType.PROJECT_CREATED,
    );
    return project;
  }
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get(':projectId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.get(identity(request), projectId);
  }

  @Patch(':projectId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
  ) {
    return this.projects.update(
      identity(request),
      projectId,
      parse(projectUpdateSchema, body),
    );
  }

  @Delete(':projectId')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = await this.projects.archive(identity(request), projectId);
    await this.activity.recordProject(
      identity(request),
      projectId,
      ActivityType.PROJECT_ARCHIVED,
    );
    await this.realtime.evictProject(projectId);
    return result;
  }

  @Get(':projectId/boards')
  boards(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.boards(identity(request), projectId);
  }

  @Post(':projectId/boards')
  async createBoard(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const board = await this.projects.createBoard(
      auth,
      projectId,
      parse(nameSchema, body).name,
    );
    await this.activity.recordBoard(auth, board.id, ActivityType.BOARD_CREATED);
    return board;
  }
}

@Controller('boards')
@UseGuards(AuthGuard)
export class BoardsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get(':boardId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ) {
    return this.projects.board(identity(request), boardId);
  }

  @Post(':boardId/columns')
  async addColumn(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const board = await this.projects.addColumn(
      auth,
      boardId,
      parse(columnSchema, body),
    );
    await this.realtime.publishBoardForIdentity(board, auth);
    await this.activity.recordBoard(
      auth,
      board.id,
      ActivityType.BOARD_UPDATED,
      { version: board.version },
    );
    return board;
  }

  @Patch(':boardId/columns/:columnId')
  async renameColumn(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const board = await this.projects.renameColumn(
      auth,
      boardId,
      columnId,
      parse(columnSchema, body),
    );
    await this.realtime.publishBoardForIdentity(board, auth);
    await this.activity.recordBoard(
      auth,
      board.id,
      ActivityType.BOARD_UPDATED,
      { version: board.version },
    );
    return board;
  }

  @Delete(':boardId/columns/:columnId')
  async removeColumn(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const board = await this.projects.removeColumn(
      auth,
      boardId,
      columnId,
      parse(versionSchema, body).expectedVersion,
    );
    await this.realtime.publishBoardForIdentity(board, auth);
    await this.activity.recordBoard(
      auth,
      board.id,
      ActivityType.BOARD_UPDATED,
      { version: board.version },
    );
    return board;
  }

  @Put(':boardId/columns/order')
  async reorderColumns(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const board = await this.projects.reorderColumns(
      auth,
      boardId,
      parse(orderSchema, body),
    );
    await this.realtime.publishBoardForIdentity(board, auth);
    await this.activity.recordBoard(
      auth,
      board.id,
      ActivityType.BOARD_UPDATED,
      { version: board.version },
    );
    return board;
  }
}
