import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';

const notificationSelect = {
  id: true,
  workspaceId: true,
  taskId: true,
  commentId: true,
  type: true,
  createdAt: true,
  readAt: true,
  actor: { select: { id: true, displayName: true } },
  workspace: { select: { name: true } },
  task: { select: { title: true, archivedAt: true } },
} as const;

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  private async scope(
    identity: AuthIdentity,
  ): Promise<Prisma.NotificationWhereInput> {
    const recipientId = (await this.users.getOrCreate(identity)).id;
    return {
      recipientId,
      workspace: {
        archivedAt: null,
        members: { some: { userId: recipientId } },
      },
    };
  }

  async list(identity: AuthIdentity, cursor?: string) {
    const where = await this.scope(identity);
    if (cursor) {
      const anchor = await this.prisma.notification.findFirst({
        where: { ...where, id: cursor },
        select: { id: true },
      });
      if (!anchor) throw new BadRequestException('Invalid cursor');
    }
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      items: rows.slice(0, 50),
      nextCursor: rows.length > 50 ? rows[49].id : null,
      unreadCount,
    };
  }

  async count(identity: AuthIdentity) {
    const where = await this.scope(identity);
    return {
      unreadCount: await this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    };
  }

  async markRead(identity: AuthIdentity, notificationId: string) {
    const where = await this.scope(identity);
    const updated = await this.prisma.notification.updateMany({
      where: { ...where, id: notificationId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const visible = await this.prisma.notification.findFirst({
        where: { ...where, id: notificationId },
        select: { id: true },
      });
      if (!visible) throw new NotFoundException('Notification not found');
    }
    return { read: true };
  }

  async markAllRead(identity: AuthIdentity) {
    const where = await this.scope(identity);
    const result = await this.prisma.notification.updateMany({
      where: { ...where, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
