import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const roleRank: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

@Injectable()
export class WorkspaceAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async require(
    workspaceId: string,
    userId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: { select: { archivedAt: true } } },
    });
    if (!membership || membership.workspace.archivedAt)
      throw new NotFoundException('Workspace not found');
    if (roleRank[membership.role] < roleRank[minimum])
      throw new ForbiddenException('Insufficient workspace role');
    return membership;
  }
}
