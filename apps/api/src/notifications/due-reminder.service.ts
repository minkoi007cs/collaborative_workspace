import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const intervalMs = 15 * 60 * 1000;
const windowMs = 24 * 60 * 60 * 1000;

@Injectable()
export class DueReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DueReminderService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.runOnce().catch((error) => this.warn(error));
    this.timer = setInterval(() => {
      void this.runOnce().catch((error) => this.warn(error));
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private warn(error: unknown) {
    this.logger.warn(
      `Due reminder scan failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  runOnce(now = new Date()): Promise<number> {
    if (this.running) return this.running;
    const scan = this.scan(now);
    this.running = scan;
    void scan
      .finally(() => {
        if (this.running === scan) this.running = undefined;
      })
      .catch(() => undefined);
    return scan;
  }

  private async scan(now: Date) {
    const horizon = new Date(now.getTime() + windowMs);
    const catchUp = new Date(now.getTime() - windowMs);
    let cursor: string | undefined;
    let created = 0;
    while (true) {
      const page = await this.prisma.$transaction(
        async (tx) => {
          const tasks = await tx.task.findMany({
            where: {
              dueAt: { gt: catchUp, lte: horizon },
              completedAt: null,
              archivedAt: null,
              board: {
                project: { status: 'ACTIVE', workspace: { archivedAt: null } },
              },
            },
            select: {
              id: true,
              dueAt: true,
              board: { select: { project: { select: { workspaceId: true } } } },
              assignees: { select: { userId: true } },
            },
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            take: 100,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          });
          const workspaceIds = [
            ...new Set(tasks.map((task) => task.board.project.workspaceId)),
          ];
          const userIds = [
            ...new Set(
              tasks.flatMap((task) =>
                task.assignees.map((assignee) => assignee.userId),
              ),
            ),
          ];
          const members =
            workspaceIds.length && userIds.length
              ? await tx.workspaceMember.findMany({
                  where: {
                    workspaceId: { in: workspaceIds },
                    userId: { in: userIds },
                  },
                  select: { workspaceId: true, userId: true },
                })
              : [];
          const memberKeys = new Set(
            members.map((member) => `${member.workspaceId}:${member.userId}`),
          );
          const notices = tasks.flatMap((task) => {
            const workspaceId = task.board.project.workspaceId;
            return task.assignees
              .filter((assignee) =>
                memberKeys.has(`${workspaceId}:${assignee.userId}`),
              )
              .map((assignee) => ({
                workspaceId,
                taskId: task.id,
                recipientId: assignee.userId,
                type: 'DUE_SOON' as const,
                dedupeKey: `due:${task.id}:${task.dueAt?.getTime()}:${assignee.userId}`,
              }));
          });
          const inserted = notices.length
            ? await tx.notification.createMany({
                data: notices,
                skipDuplicates: true,
              })
            : { count: 0 };
          return {
            count: inserted.count,
            lastId: tasks.at(-1)?.id,
            full: tasks.length === 100,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      created += page.count;
      if (!page.full || !page.lastId) break;
      cursor = page.lastId;
    }
    return created;
  }
}
