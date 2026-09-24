import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TaskPriority } from '@prisma/client';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';

type SearchRow = {
  taskId: string;
  boardId: string;
  projectId: string;
  projectName: string;
  boardName: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: Date | null;
  rank: number;
};

@Injectable()
export class SearchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async tasks(
    identity: AuthIdentity,
    workspaceId: string,
    input: {
      q: string;
      page: number;
      projectId?: string;
      assigneeId?: string;
      priority?: TaskPriority;
    },
  ) {
    const userId = (await this.users.getOrCreate(identity)).id;
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, workspace: { archivedAt: null } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Workspace not found');

    const filters: Prisma.Sql[] = [
      Prisma.sql`w.id = ${workspaceId}::uuid`,
      Prisma.sql`w.archived_at IS NULL`,
      Prisma.sql`p.status = 'ACTIVE'`,
      Prisma.sql`t.archived_at IS NULL`,
      Prisma.sql`to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '')) @@ plainto_tsquery('simple', ${input.q})`,
    ];
    if (input.projectId)
      filters.push(Prisma.sql`p.id = ${input.projectId}::uuid`);
    if (input.priority)
      filters.push(Prisma.sql`t.priority::text = ${input.priority}`);
    if (input.assigneeId)
      filters.push(
        Prisma.sql`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ${input.assigneeId}::uuid)`,
      );
    const offset = (input.page - 1) * 20;
    const rows = await this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT
        t.id AS "taskId", b.id AS "boardId", p.id AS "projectId",
        p.name AS "projectName", b.name AS "boardName",
        t.title, t.description, t.priority, t.due_at AS "dueAt",
        ts_rank_cd(
          to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '')),
          plainto_tsquery('simple', ${input.q})
        ) AS rank
      FROM tasks t
      JOIN boards b ON b.id = t.board_id
      JOIN projects p ON p.id = b.project_id
      JOIN workspaces w ON w.id = p.workspace_id
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY rank DESC, t.id ASC
      LIMIT 21 OFFSET ${offset}
    `);
    return {
      items: rows.slice(0, 20),
      hasMore: rows.length > 20,
      page: input.page,
    };
  }
}
