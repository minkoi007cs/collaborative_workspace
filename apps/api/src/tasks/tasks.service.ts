import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { evenRanks, rankBetween } from './rank';

const taskSelect = {
  id: true,
  boardId: true,
  columnId: true,
  title: true,
  description: true,
  rank: true,
  priority: true,
  dueAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  assignees: {
    select: { user: { select: { id: true, displayName: true, email: true } } },
  },
  labels: {
    select: { label: { select: { id: true, name: true, color: true } } },
  },
} as const;
const labelSelect = {
  id: true,
  name: true,
  color: true,
  createdAt: true,
} as const;

type UpdateInput = {
  expectedVersion: number;
  title?: string;
  description?: string | null;
  priority?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt?: string | null;
  completed?: boolean;
};

@Injectable()
export class TasksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  private async userId(identity: AuthIdentity) {
    return (await this.users.getOrCreate(identity)).id;
  }

  private async requireTask(
    identity: AuthIdentity,
    taskId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, boardId: true, archivedAt: true, completedAt: true },
    });
    if (!task || task.archivedAt) throw new NotFoundException('Task not found');
    const board = await this.projects.requireBoard(
      identity,
      task.boardId,
      minimum,
    );
    return { task, board };
  }

  private conflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    )
      throw new ConflictException(
        'Task changed concurrently; refresh and try again',
      );
    throw error;
  }

  private async rebalance(tx: Prisma.TransactionClient, columnId: string) {
    const rows = await tx.task.findMany({
      where: { columnId },
      orderBy: [{ rank: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const ranks = evenRanks(rows.length);
    for (const [index, row] of rows.entries())
      await tx.task.update({
        where: { id: row.id },
        data: { rank: `y${index.toString().padStart(17, '0')}` },
      });
    for (const [index, row] of rows.entries())
      await tx.task.update({
        where: { id: row.id },
        data: { rank: ranks[index] },
      });
  }

  async list(identity: AuthIdentity, boardId: string, cursor?: string) {
    await this.projects.requireBoard(identity, boardId);
    if (cursor) {
      const cursorTask = await this.prisma.task.findFirst({
        where: { id: cursor, boardId, archivedAt: null },
        select: { id: true },
      });
      if (!cursorTask) throw new BadRequestException('Invalid cursor');
    }
    const rows = await this.prisma.task.findMany({
      where: { boardId, archivedAt: null },
      orderBy: [
        { column: { position: 'asc' } },
        { rank: 'asc' },
        { id: 'asc' },
      ],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 101,
      select: taskSelect,
    });
    const items = rows.slice(0, 100);
    return { items, nextCursor: rows.length > 100 ? items[99].id : null };
  }

  async create(
    identity: AuthIdentity,
    boardId: string,
    input: { title: string; columnId: string },
  ) {
    const board = await this.projects.requireBoard(
      identity,
      boardId,
      WorkspaceRole.EDITOR,
    );
    const userId = await this.userId(identity);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const column = await tx.column.findFirst({
            where: { id: input.columnId, boardId },
            select: { id: true },
          });
          if (!column)
            throw new BadRequestException('Column does not belong to board');
          const activeBoard = await tx.board.findFirst({
            where: {
              id: board.id,
              project: { status: 'ACTIVE', workspace: { archivedAt: null } },
            },
            select: { id: true },
          });
          if (!activeBoard) throw new NotFoundException('Board not found');
          let last = await tx.task.findFirst({
            where: { columnId: input.columnId },
            orderBy: { rank: 'desc' },
            select: { rank: true },
          });
          let rank = rankBetween(last?.rank ?? null, null);
          if (!rank) {
            await this.rebalance(tx, input.columnId);
            last = await tx.task.findFirst({
              where: { columnId: input.columnId },
              orderBy: { rank: 'desc' },
              select: { rank: true },
            });
            rank = rankBetween(last?.rank ?? null, null);
          }
          if (!rank) throw new ConflictException('Column ordering unavailable');
          return tx.task.create({
            data: {
              boardId,
              columnId: input.columnId,
              title: input.title,
              rank,
              createdBy: userId,
            },
            select: taskSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.conflict(error);
    }
  }

  async get(identity: AuthIdentity, taskId: string) {
    await this.requireTask(identity, taskId);
    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: taskSelect,
    });
  }

  async update(identity: AuthIdentity, taskId: string, input: UpdateInput) {
    const { task } = await this.requireTask(
      identity,
      taskId,
      WorkspaceRole.EDITOR,
    );
    const { expectedVersion, completed, dueAt, ...fields } = input;
    const data: Prisma.TaskUpdateManyMutationInput = {
      ...fields,
      version: { increment: 1 },
    };
    if (dueAt !== undefined)
      data.dueAt = dueAt === null ? null : new Date(dueAt);
    if (completed !== undefined)
      data.completedAt = completed ? (task.completedAt ?? new Date()) : null;
    const changed = await this.prisma.task.updateMany({
      where: { id: taskId, version: expectedVersion, archivedAt: null },
      data,
    });
    if (changed.count !== 1)
      throw new ConflictException('Task changed; refresh and try again');
    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: taskSelect,
    });
  }

  async move(
    identity: AuthIdentity,
    taskId: string,
    input: {
      expectedVersion: number;
      toColumnId: string;
      beforeTaskId?: string | null;
    },
  ) {
    const { board } = await this.requireTask(
      identity,
      taskId,
      WorkspaceRole.EDITOR,
    );
    if (input.beforeTaskId === taskId)
      throw new BadRequestException('Task cannot move before itself');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const task = await tx.task.findFirst({
            where: { id: taskId, boardId: board.id, archivedAt: null },
            select: { id: true, version: true },
          });
          if (!task || task.version !== input.expectedVersion)
            throw new ConflictException('Task changed; refresh and try again');
          const column = await tx.column.findFirst({
            where: { id: input.toColumnId, boardId: board.id },
            select: { id: true },
          });
          if (!column)
            throw new BadRequestException('Column does not belong to board');
          if (input.beforeTaskId) {
            const before = await tx.task.findFirst({
              where: {
                id: input.beforeTaskId,
                columnId: input.toColumnId,
                archivedAt: null,
              },
              select: { id: true },
            });
            if (!before)
              throw new BadRequestException('Target task is not in column');
          }
          const claimed = await tx.task.updateMany({
            where: {
              id: taskId,
              version: input.expectedVersion,
              archivedAt: null,
            },
            data: {
              columnId: input.toColumnId,
              rank: `x${randomBytes(8).toString('hex')}`,
              version: { increment: 1 },
            },
          });
          if (claimed.count !== 1)
            throw new ConflictException('Task changed; refresh and try again');
          let rows = await tx.task.findMany({
            where: { columnId: input.toColumnId, id: { not: taskId } },
            orderBy: [{ rank: 'asc' }, { id: 'asc' }],
            select: { id: true, rank: true },
          });
          const position = input.beforeTaskId
            ? rows.findIndex((row) => row.id === input.beforeTaskId)
            : rows.length;
          if (position < 0) throw new ConflictException('Target order changed');
          let rank = rankBetween(
            rows[position - 1]?.rank ?? null,
            rows[position]?.rank ?? null,
          );
          if (!rank) {
            await this.rebalance(tx, input.toColumnId);
            rows = await tx.task.findMany({
              where: { columnId: input.toColumnId, id: { not: taskId } },
              orderBy: [{ rank: 'asc' }, { id: 'asc' }],
              select: { id: true, rank: true },
            });
            rank = rankBetween(
              rows[position - 1]?.rank ?? null,
              rows[position]?.rank ?? null,
            );
          }
          if (!rank) throw new ConflictException('Column ordering unavailable');
          await tx.task.update({ where: { id: taskId }, data: { rank } });
          return tx.task.findUniqueOrThrow({
            where: { id: taskId },
            select: taskSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.conflict(error);
    }
  }

  private async replaceRelations(
    identity: AuthIdentity,
    taskId: string,
    expectedVersion: number,
    replace: (
      tx: Prisma.TransactionClient,
      board: Awaited<ReturnType<ProjectsService['requireBoard']>>,
    ) => Promise<void>,
  ) {
    const { board } = await this.requireTask(
      identity,
      taskId,
      WorkspaceRole.EDITOR,
    );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const changed = await tx.task.updateMany({
            where: { id: taskId, version: expectedVersion, archivedAt: null },
            data: { version: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new ConflictException('Task changed; refresh and try again');
          await replace(tx, board);
          return tx.task.findUniqueOrThrow({
            where: { id: taskId },
            select: taskSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.conflict(error);
    }
  }

  async setAssignees(
    identity: AuthIdentity,
    taskId: string,
    input: { expectedVersion: number; userIds: string[] },
  ) {
    if (new Set(input.userIds).size !== input.userIds.length)
      throw new BadRequestException('Duplicate assignee');
    return this.replaceRelations(
      identity,
      taskId,
      input.expectedVersion,
      async (tx, board) => {
        const count = await tx.workspaceMember.count({
          where: {
            workspaceId: board.project.workspaceId,
            userId: { in: input.userIds },
          },
        });
        if (count !== input.userIds.length)
          throw new BadRequestException('Assignee must belong to workspace');
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (input.userIds.length)
          await tx.taskAssignee.createMany({
            data: input.userIds.map((userId) => ({ taskId, userId })),
          });
      },
    );
  }

  async setLabels(
    identity: AuthIdentity,
    taskId: string,
    input: { expectedVersion: number; labelIds: string[] },
  ) {
    if (new Set(input.labelIds).size !== input.labelIds.length)
      throw new BadRequestException('Duplicate label');
    return this.replaceRelations(
      identity,
      taskId,
      input.expectedVersion,
      async (tx, board) => {
        const count = await tx.label.count({
          where: { projectId: board.projectId, id: { in: input.labelIds } },
        });
        if (count !== input.labelIds.length)
          throw new BadRequestException('Label must belong to project');
        await tx.taskLabel.deleteMany({ where: { taskId } });
        if (input.labelIds.length)
          await tx.taskLabel.createMany({
            data: input.labelIds.map((labelId) => ({ taskId, labelId })),
          });
      },
    );
  }

  async archive(
    identity: AuthIdentity,
    taskId: string,
    expectedVersion: number,
  ) {
    await this.requireTask(identity, taskId, WorkspaceRole.EDITOR);
    const changed = await this.prisma.task.updateMany({
      where: { id: taskId, version: expectedVersion, archivedAt: null },
      data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException('Task changed; refresh and try again');
    return { archived: true };
  }

  async copy(identity: AuthIdentity, taskId: string) {
    const { board } = await this.requireTask(
      identity,
      taskId,
      WorkspaceRole.EDITOR,
    );
    const userId = await this.userId(identity);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const source = await tx.task.findFirst({
            where: { id: taskId, archivedAt: null },
            include: {
              assignees: { select: { userId: true } },
              labels: { select: { labelId: true } },
            },
          });
          if (!source) throw new NotFoundException('Task not found');
          const activeBoard = await tx.board.findFirst({
            where: {
              id: board.id,
              project: { status: 'ACTIVE', workspace: { archivedAt: null } },
            },
            select: { id: true },
          });
          if (!activeBoard) throw new NotFoundException('Board not found');
          let last = await tx.task.findFirst({
            where: { columnId: source.columnId },
            orderBy: { rank: 'desc' },
            select: { rank: true },
          });
          let rank = rankBetween(last?.rank ?? null, null);
          if (!rank) {
            await this.rebalance(tx, source.columnId);
            last = await tx.task.findFirst({
              where: { columnId: source.columnId },
              orderBy: { rank: 'desc' },
              select: { rank: true },
            });
            rank = rankBetween(last?.rank ?? null, null);
          }
          if (!rank) throw new ConflictException('Column ordering unavailable');
          return tx.task.create({
            data: {
              boardId: source.boardId,
              columnId: source.columnId,
              title: `${source.title.slice(0, 193)} (copy)`,
              description: source.description,
              priority: source.priority,
              dueAt: source.dueAt,
              rank,
              createdBy: userId,
              assignees: {
                create: source.assignees.map((assignee) => ({
                  userId: assignee.userId,
                })),
              },
              labels: {
                create: source.labels.map((label) => ({
                  labelId: label.labelId,
                })),
              },
            },
            select: taskSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.conflict(error);
    }
  }

  async deletePermanent(
    identity: AuthIdentity,
    taskId: string,
    expectedVersion: number,
  ) {
    await this.requireTask(identity, taskId, WorkspaceRole.ADMIN);
    const deleted = await this.prisma.task.deleteMany({
      where: { id: taskId, version: expectedVersion, archivedAt: null },
    });
    if (deleted.count !== 1)
      throw new ConflictException('Task changed; refresh and try again');
    return { deleted: true };
  }

  async listLabels(identity: AuthIdentity, projectId: string) {
    await this.projects.requireProject(identity, projectId);
    return this.prisma.label.findMany({
      where: { projectId },
      select: labelSelect,
      orderBy: { name: 'asc' },
    });
  }

  async createLabel(
    identity: AuthIdentity,
    projectId: string,
    input: { name: string; color: string },
  ) {
    await this.projects.requireProject(
      identity,
      projectId,
      WorkspaceRole.EDITOR,
    );
    try {
      return await this.prisma.label.create({
        data: { projectId, name: input.name, color: input.color.toLowerCase() },
        select: labelSelect,
      });
    } catch (error) {
      this.conflict(error);
    }
  }
}
