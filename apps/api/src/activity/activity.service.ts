import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, type Prisma } from '@prisma/client';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';

const activitySelect = {
  id: true,
  workspaceId: true,
  projectId: true,
  taskId: true,
  entityType: true,
  entityId: true,
  eventType: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  private async record(
    identity: AuthIdentity,
    input: {
      workspaceId: string;
      projectId?: string;
      taskId?: string;
      entityType: string;
      entityId: string;
      eventType: ActivityType;
      metadata?: Prisma.InputJsonObject;
    },
  ) {
    try {
      const actorId = (await this.users.getOrCreate(identity)).id;
      await this.prisma.activityEvent.create({
        data: { ...input, actorId, metadata: input.metadata ?? {} },
      });
    } catch (error) {
      this.logger.warn(
        `Activity write failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async boardScope(boardId: string) {
    try {
      return await this.prisma.board.findUnique({
        where: { id: boardId },
        select: { projectId: true, project: { select: { workspaceId: true } } },
      });
    } catch (error) {
      this.logger.warn(
        `Activity board lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  async recordTask(
    identity: AuthIdentity,
    boardId: string,
    taskId: string,
    eventType: ActivityType,
    metadata?: Prisma.InputJsonObject,
  ) {
    const board = await this.boardScope(boardId);
    if (!board) return;
    await this.record(identity, {
      workspaceId: board.project.workspaceId,
      projectId: board.projectId,
      taskId: eventType === ActivityType.TASK_DELETED ? undefined : taskId,
      entityType: 'task',
      entityId: taskId,
      eventType,
      metadata,
    });
  }

  async recordComment(
    identity: AuthIdentity,
    boardId: string,
    taskId: string,
    commentId: string,
    eventType: ActivityType,
  ) {
    const board = await this.boardScope(boardId);
    if (!board) return;
    await this.record(identity, {
      workspaceId: board.project.workspaceId,
      projectId: board.projectId,
      taskId,
      entityType: 'comment',
      entityId: commentId,
      eventType,
    });
  }

  async recordWorkspace(
    identity: AuthIdentity,
    workspaceId: string,
    entityType: string,
    entityId: string,
    eventType: ActivityType,
    metadata?: Prisma.InputJsonObject,
  ) {
    await this.record(identity, {
      workspaceId,
      entityType,
      entityId,
      eventType,
      metadata,
    });
  }

  async recordProject(
    identity: AuthIdentity,
    projectId: string,
    eventType: ActivityType,
  ) {
    let project: { workspaceId: string } | null;
    try {
      project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      });
    } catch (error) {
      this.logger.warn(
        `Activity project lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return;
    }
    if (!project) return;
    await this.record(identity, {
      workspaceId: project.workspaceId,
      projectId,
      entityType: 'project',
      entityId: projectId,
      eventType,
    });
  }

  async recordBoard(
    identity: AuthIdentity,
    boardId: string,
    eventType: ActivityType,
    metadata?: Prisma.InputJsonObject,
  ) {
    const board = await this.boardScope(boardId);
    if (!board) return;
    await this.record(identity, {
      workspaceId: board.project.workspaceId,
      projectId: board.projectId,
      entityType: 'board',
      entityId: boardId,
      eventType,
      metadata,
    });
  }

  private async page(where: Prisma.ActivityEventWhereInput, cursor?: string) {
    if (cursor) {
      const anchor = await this.prisma.activityEvent.findFirst({
        where: { ...where, id: cursor },
        select: { id: true },
      });
      if (!anchor) throw new BadRequestException('Invalid cursor');
    }
    const rows = await this.prisma.activityEvent.findMany({
      where,
      select: activitySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }

  async workspace(
    identity: AuthIdentity,
    workspaceId: string,
    cursor?: string,
  ) {
    const actorId = (await this.users.getOrCreate(identity)).id;
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: actorId, workspace: { archivedAt: null } },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Workspace not found');
    return this.page({ workspaceId }, cursor);
  }

  async task(identity: AuthIdentity, taskId: string, cursor?: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        archivedAt: null,
        board: {
          project: { status: 'ACTIVE', workspace: { archivedAt: null } },
        },
      },
      select: {
        board: { select: { project: { select: { workspaceId: true } } } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    const actorId = (await this.users.getOrCreate(identity)).id;
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: task.board.project.workspaceId, userId: actorId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Task not found');
    return this.page({ taskId }, cursor);
  }
}
