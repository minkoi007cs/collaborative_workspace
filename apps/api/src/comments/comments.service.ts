import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';

const commentSelect = {
  id: true,
  taskId: true,
  content: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, displayName: true } },
  mentions: {
    select: { user: { select: { id: true, displayName: true, email: true } } },
  },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  private async task(
    identity: AuthIdentity,
    taskId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, archivedAt: null },
      select: { id: true, boardId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    const board = await this.projects.requireBoard(
      identity,
      task.boardId,
      minimum,
    );
    return { task, board };
  }

  private async comment(
    identity: AuthIdentity,
    commentId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null, task: { archivedAt: null } },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        version: true,
        task: { select: { boardId: true } },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    const board = await this.projects.requireBoard(
      identity,
      comment.task.boardId,
      minimum,
    );
    return { comment, board };
  }

  private async mentions(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    content: string,
  ) {
    const emails = [
      ...new Set(
        [
          ...content.matchAll(
            /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
          ),
        ].map((match) => match[1].toLowerCase()),
      ),
    ];
    if (emails.length > 20) throw new BadRequestException('Too many mentions');
    if (emails.length === 0) return [];
    const members = await tx.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { in: emails, mode: 'insensitive' } },
      },
      select: { user: { select: { id: true, email: true } } },
    });
    const found = new Set(
      members.map((member) => member.user.email.toLowerCase()),
    );
    if (emails.some((email) => !found.has(email)))
      throw new BadRequestException('Mentioned user is not a workspace member');
    return [...new Set(members.map((member) => member.user.id))];
  }

  private conflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    )
      throw new ConflictException('Comment changed; refresh and try again');
    throw error;
  }

  async list(identity: AuthIdentity, taskId: string, cursor?: string) {
    await this.task(identity, taskId);
    if (cursor) {
      const anchor = await this.prisma.comment.findFirst({
        where: { id: cursor, taskId, deletedAt: null },
        select: { id: true },
      });
      if (!anchor) throw new BadRequestException('Invalid cursor');
    }
    const rows = await this.prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      select: commentSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }

  async create(identity: AuthIdentity, taskId: string, content: string) {
    const { board } = await this.task(identity, taskId, WorkspaceRole.EDITOR);
    const authorId = (await this.users.getOrCreate(identity)).id;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const userIds = await this.mentions(
            tx,
            board.project.workspaceId,
            content,
          );
          const comment = await tx.comment.create({
            data: {
              taskId,
              authorId,
              content,
              mentions: { create: userIds.map((userId) => ({ userId })) },
            },
            select: commentSelect,
          });
          const recipientIds = userIds.filter((id) => id !== authorId);
          if (recipientIds.length)
            await tx.notification.createMany({
              data: recipientIds.map((recipientId) => ({
                workspaceId: board.project.workspaceId,
                taskId,
                commentId: comment.id,
                recipientId,
                actorId: authorId,
                type: 'MENTION',
              })),
            });
          const task = await tx.task.findUniqueOrThrow({
            where: { id: taskId },
            select: {
              createdBy: true,
              assignees: { select: { userId: true } },
            },
          });
          const candidateIds = [
            ...new Set([
              task.createdBy,
              ...task.assignees.map((entry) => entry.userId),
            ]),
          ].filter((id) => id !== authorId && !recipientIds.includes(id));
          const currentMembers = await tx.workspaceMember.findMany({
            where: {
              workspaceId: board.project.workspaceId,
              userId: { in: candidateIds },
            },
            select: { userId: true },
          });
          const commentRecipientIds = currentMembers.map(
            (member) => member.userId,
          );
          if (commentRecipientIds.length)
            await tx.notification.createMany({
              data: commentRecipientIds.map((recipientId) => ({
                workspaceId: board.project.workspaceId,
                taskId,
                commentId: comment.id,
                recipientId,
                actorId: authorId,
                type: 'COMMENT',
              })),
            });
          return {
            comment,
            boardId: board.id,
            recipientIds,
            commentRecipientIds,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.conflict(error);
    }
  }

  async update(
    identity: AuthIdentity,
    commentId: string,
    content: string,
    expectedVersion: number,
  ) {
    const { comment, board } = await this.comment(
      identity,
      commentId,
      WorkspaceRole.EDITOR,
    );
    const authorId = (await this.users.getOrCreate(identity)).id;
    if (comment.authorId !== authorId)
      throw new ForbiddenException('Only the author can edit this comment');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const userIds = await this.mentions(
            tx,
            board.project.workspaceId,
            content,
          );
          const current = await tx.commentMention.findMany({
            where: { commentId },
            select: { userId: true },
          });
          const oldIds = new Set(current.map((entry) => entry.userId));
          const changed = await tx.comment.updateMany({
            where: { id: commentId, version: expectedVersion, deletedAt: null },
            data: { content, version: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new ConflictException(
              'Comment changed; refresh and try again',
            );
          await tx.commentMention.deleteMany({ where: { commentId } });
          if (userIds.length)
            await tx.commentMention.createMany({
              data: userIds.map((userId) => ({ commentId, userId })),
            });
          const recipientIds = userIds.filter(
            (id) => id !== authorId && !oldIds.has(id),
          );
          if (recipientIds.length)
            await tx.notification.createMany({
              data: recipientIds.map((recipientId) => ({
                workspaceId: board.project.workspaceId,
                taskId: comment.taskId,
                commentId,
                recipientId,
                actorId: authorId,
                type: 'MENTION',
              })),
            });
          const updated = await tx.comment.findUniqueOrThrow({
            where: { id: commentId },
            select: commentSelect,
          });
          return { comment: updated, boardId: board.id, recipientIds };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.conflict(error);
    }
  }

  async remove(
    identity: AuthIdentity,
    commentId: string,
    expectedVersion: number,
  ) {
    const { comment, board } = await this.comment(
      identity,
      commentId,
      WorkspaceRole.EDITOR,
    );
    const authorId = (await this.users.getOrCreate(identity)).id;
    if (comment.authorId !== authorId)
      throw new ForbiddenException('Only the author can delete this comment');
    const changed = await this.prisma.comment.updateMany({
      where: { id: commentId, version: expectedVersion, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException('Comment changed; refresh and try again');
    return {
      deleted: true,
      id: commentId,
      taskId: comment.taskId,
      boardId: board.id,
      version: expectedVersion + 1,
      author: { id: authorId },
    };
  }
}
