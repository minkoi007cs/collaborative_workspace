import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';

const columns = {
  orderBy: { position: 'asc' as const },
  select: {
    id: true,
    name: true,
    position: true,
    createdAt: true,
    updatedAt: true,
  },
};
const boardSelect = {
  id: true,
  projectId: true,
  name: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  columns,
};
const projectSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  boards: { select: boardSelect, orderBy: { createdAt: 'asc' as const } },
};
const defaultColumns = [
  { name: 'To do', position: 0 },
  { name: 'In progress', position: 1 },
  { name: 'Done', position: 2 },
];

type ProjectInput = { name: string; description?: string | null };
type ColumnInput = { name: string; expectedVersion: number };

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(WorkspaceAccessService)
    private readonly access: WorkspaceAccessService,
  ) {}

  private async userId(identity: AuthIdentity) {
    return (await this.users.getOrCreate(identity)).id;
  }

  private async requireProject(
    identity: AuthIdentity,
    projectId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, status: true },
    });
    if (project?.status !== 'ACTIVE')
      throw new NotFoundException('Project not found');
    await this.access.require(
      project.workspaceId,
      await this.userId(identity),
      minimum,
    );
    return project;
  }

  private async requireBoard(
    identity: AuthIdentity,
    boardId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        projectId: true,
        project: { select: { workspaceId: true, status: true } },
      },
    });
    if (board?.project.status !== 'ACTIVE')
      throw new NotFoundException('Board not found');
    await this.access.require(
      board.project.workspaceId,
      await this.userId(identity),
      minimum,
    );
    return board;
  }

  async list(identity: AuthIdentity, workspaceId: string) {
    await this.access.require(workspaceId, await this.userId(identity));
    return this.prisma.project.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: projectSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    identity: AuthIdentity,
    workspaceId: string,
    input: ProjectInput,
  ) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.ADMIN);
    return this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        createdBy: userId,
        boards: {
          create: { name: 'Main board', columns: { create: defaultColumns } },
        },
      },
      select: projectSelect,
    });
  }

  async get(identity: AuthIdentity, projectId: string) {
    await this.requireProject(identity, projectId);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: projectSelect,
    });
  }

  async update(
    identity: AuthIdentity,
    projectId: string,
    input: Partial<ProjectInput>,
  ) {
    await this.requireProject(identity, projectId, WorkspaceRole.ADMIN);
    return this.prisma.project.update({
      where: { id: projectId },
      data: input,
      select: projectSelect,
    });
  }

  async archive(identity: AuthIdentity, projectId: string) {
    await this.requireProject(identity, projectId, WorkspaceRole.ADMIN);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    return { archived: true };
  }

  async boards(identity: AuthIdentity, projectId: string) {
    await this.requireProject(identity, projectId);
    return this.prisma.board.findMany({
      where: { projectId },
      select: boardSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async createBoard(identity: AuthIdentity, projectId: string, name: string) {
    await this.requireProject(identity, projectId, WorkspaceRole.ADMIN);
    return this.prisma.board.create({
      data: { projectId, name, columns: { create: defaultColumns } },
      select: boardSelect,
    });
  }

  async board(identity: AuthIdentity, boardId: string) {
    await this.requireBoard(identity, boardId);
    return this.prisma.board.findUniqueOrThrow({
      where: { id: boardId },
      select: boardSelect,
    });
  }

  private async mutateBoard(
    identity: AuthIdentity,
    boardId: string,
    expectedVersion: number,
    mutate: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    await this.requireBoard(identity, boardId, WorkspaceRole.ADMIN);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.board.updateMany({
            where: {
              id: boardId,
              version: expectedVersion,
              project: { status: 'ACTIVE', workspace: { archivedAt: null } },
            },
            data: { version: { increment: 1 } },
          });
          if (claimed.count !== 1)
            throw new ConflictException('Board changed; refresh and try again');
          await mutate(tx);
          return tx.board.findUniqueOrThrow({
            where: { id: boardId },
            select: boardSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException('Board changed; refresh and try again');
      throw error;
    }
  }

  async addColumn(identity: AuthIdentity, boardId: string, input: ColumnInput) {
    return this.mutateBoard(
      identity,
      boardId,
      input.expectedVersion,
      async (tx) => {
        const existing = await tx.column.findMany({
          where: { boardId },
          select: { position: true },
          orderBy: { position: 'desc' },
        });
        if (existing.length >= 20)
          throw new ConflictException('Board already has 20 columns');
        await tx.column.create({
          data: {
            boardId,
            name: input.name,
            position: (existing[0]?.position ?? -1) + 1,
          },
        });
      },
    );
  }

  async renameColumn(
    identity: AuthIdentity,
    boardId: string,
    columnId: string,
    input: ColumnInput,
  ) {
    return this.mutateBoard(
      identity,
      boardId,
      input.expectedVersion,
      async (tx) => {
        const changed = await tx.column.updateMany({
          where: { id: columnId, boardId },
          data: { name: input.name },
        });
        if (changed.count !== 1)
          throw new NotFoundException('Column not found');
      },
    );
  }

  async removeColumn(
    identity: AuthIdentity,
    boardId: string,
    columnId: string,
    expectedVersion: number,
  ) {
    return this.mutateBoard(identity, boardId, expectedVersion, async (tx) => {
      const removed = await tx.column.deleteMany({
        where: { id: columnId, boardId },
      });
      if (removed.count !== 1) throw new NotFoundException('Column not found');
      const remaining = await tx.column.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (const [position, column] of remaining.entries())
        await tx.column.update({
          where: { id: column.id },
          data: { position },
        });
    });
  }

  async reorderColumns(
    identity: AuthIdentity,
    boardId: string,
    input: { expectedVersion: number; columnIds: string[] },
  ) {
    return this.mutateBoard(
      identity,
      boardId,
      input.expectedVersion,
      async (tx) => {
        const current = await tx.column.findMany({
          where: { boardId },
          select: { id: true },
        });
        if (
          current.length !== input.columnIds.length ||
          new Set(input.columnIds).size !== input.columnIds.length ||
          current.some((column) => !input.columnIds.includes(column.id))
        )
          throw new ConflictException(
            'Column list changed; refresh and try again',
          );
        for (const [position, id] of input.columnIds.entries())
          await tx.column.update({ where: { id }, data: { position } });
      },
    );
  }
}
