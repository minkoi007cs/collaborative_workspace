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
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
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
  ) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.projects.list(identity(request), workspaceId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.projects.create(
      identity(request),
      workspaceId,
      parse(projectSchema, body),
    );
  }
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
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
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.archive(identity(request), projectId);
  }

  @Get(':projectId/boards')
  boards(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.boards(identity(request), projectId);
  }

  @Post(':projectId/boards')
  createBoard(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
  ) {
    return this.projects.createBoard(
      identity(request),
      projectId,
      parse(nameSchema, body).name,
    );
  }
}

@Controller('boards')
@UseGuards(AuthGuard)
export class BoardsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Get(':boardId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ) {
    return this.projects.board(identity(request), boardId);
  }

  @Post(':boardId/columns')
  addColumn(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() body: unknown,
  ) {
    return this.projects.addColumn(
      identity(request),
      boardId,
      parse(columnSchema, body),
    );
  }

  @Patch(':boardId/columns/:columnId')
  renameColumn(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() body: unknown,
  ) {
    return this.projects.renameColumn(
      identity(request),
      boardId,
      columnId,
      parse(columnSchema, body),
    );
  }

  @Delete(':boardId/columns/:columnId')
  removeColumn(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() body: unknown,
  ) {
    return this.projects.removeColumn(
      identity(request),
      boardId,
      columnId,
      parse(versionSchema, body).expectedVersion,
    );
  }

  @Put(':boardId/columns/order')
  reorderColumns(
    @Req() request: AuthenticatedRequest,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() body: unknown,
  ) {
    return this.projects.reorderColumns(
      identity(request),
      boardId,
      parse(orderSchema, body),
    );
  }
}
