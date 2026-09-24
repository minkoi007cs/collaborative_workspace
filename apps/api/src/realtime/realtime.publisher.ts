import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Namespace } from 'socket.io';
import { PrismaService } from '../database/prisma.service';
import type { AuthIdentity } from '../auth/auth.types';
import { UsersService } from '../users/users.service';

export type TaskEventName =
  | 'task.created'
  | 'task.updated'
  | 'task.moved'
  | 'task.deleted';
type EntityEvent = TaskEventName | 'board.updated';

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);
  private namespace?: Namespace;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async publishTaskForIdentity(
    event: TaskEventName,
    task: { id: string; boardId: string; version: number },
    identity: AuthIdentity,
  ) {
    if (!this.namespace) return;
    try {
      const actorId = (await this.users.getOrCreate(identity)).id;
      await this.publishEntity(
        event,
        task.boardId,
        task.id,
        task.version,
        actorId,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${event}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  attach(namespace: Namespace) {
    this.namespace = namespace;
  }

  async publishBoardForIdentity(
    board: { id: string; version: number },
    identity: AuthIdentity,
  ) {
    if (!this.namespace) return;
    try {
      const actorId = (await this.users.getOrCreate(identity)).id;
      await this.publishEntity(
        'board.updated',
        board.id,
        board.id,
        board.version,
        actorId,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish board.updated: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async publishEntity(
    event: EntityEvent,
    boardId: string,
    entityId: string,
    version: number,
    actorId: string,
  ) {
    if (!this.namespace) return;
    try {
      const board = await this.prisma.board.findUnique({
        where: { id: boardId },
        select: { projectId: true, project: { select: { workspaceId: true } } },
      });
      if (!board) return;
      this.namespace.to(`board:${boardId}`).emit(event, {
        event,
        eventId: randomUUID(),
        workspaceId: board.project.workspaceId,
        projectId: board.projectId,
        boardId,
        entityId,
        actorId,
        version,
        timestamp: new Date().toISOString(),
        payload: {},
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${event}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  evictUser(userId: string) {
    this.namespace?.in(`user:${userId}`).disconnectSockets(true);
  }

  publishPresence(
    event: 'presence.online' | 'presence.offline',
    workspaceId: string,
    userId: string,
    displayName: string,
  ) {
    this.namespace?.to(`workspace:${workspaceId}`).emit(event, {
      event,
      eventId: randomUUID(),
      workspaceId,
      entityId: userId,
      actorId: userId,
      timestamp: new Date().toISOString(),
      payload: { displayName },
    });
  }

  evictWorkspace(workspaceId: string) {
    this.namespace?.in(`workspace:${workspaceId}`).disconnectSockets(true);
  }

  async evictProject(projectId: string) {
    if (!this.namespace) return;
    try {
      const boards = await this.prisma.board.findMany({
        where: { projectId },
        select: { id: true },
      });
      for (const board of boards)
        this.namespace.in(`board:${board.id}`).disconnectSockets(true);
    } catch (error) {
      this.logger.warn(
        `Failed to evict archived project sockets: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  publishComment(
    event: 'comment.created' | 'comment.updated' | 'comment.deleted',
    comment: {
      id: string;
      taskId: string;
      version: number;
      author: { id: string };
    },
    boardId: string,
  ) {
    this.namespace?.to(`task:${comment.taskId}`).emit(event, {
      event,
      eventId: randomUUID(),
      boardId,
      taskId: comment.taskId,
      entityId: comment.id,
      actorId: comment.author.id,
      version: comment.version,
      timestamp: new Date().toISOString(),
      payload: {},
    });
  }

  publishMentions(recipientIds: string[], commentId: string, taskId: string) {
    for (const recipientId of recipientIds)
      this.namespace?.to(`user:${recipientId}`).emit('notification.created', {
        event: 'notification.created',
        eventId: randomUUID(),
        entityId: commentId,
        taskId,
        timestamp: new Date().toISOString(),
        payload: { type: 'MENTION' },
      });
  }

  evictTask(taskId: string) {
    this.namespace?.in(`task:${taskId}`).disconnectSockets(true);
  }
}
