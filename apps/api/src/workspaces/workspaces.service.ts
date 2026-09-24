import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { WorkspaceAccessService } from './workspace-access.service';

const workspaceSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true } },
} as const;

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(WorkspaceAccessService)
    private readonly access: WorkspaceAccessService,
    @Inject(RealtimePublisher) private readonly realtime: RealtimePublisher,
  ) {}

  private async userId(identity: AuthIdentity) {
    return (await this.users.getOrCreate(identity)).id;
  }

  async list(identity: AuthIdentity) {
    const userId = await this.userId(identity);
    return this.prisma.workspace.findMany({
      where: { archivedAt: null, members: { some: { userId } } },
      select: workspaceSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(identity: AuthIdentity, name: string) {
    const userId = await this.userId(identity);
    return this.prisma.workspace.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
      select: workspaceSelect,
    });
  }

  async get(identity: AuthIdentity, workspaceId: string) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId);
    return this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: workspaceSelect,
    });
  }

  async rename(identity: AuthIdentity, workspaceId: string, name: string) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.ADMIN);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
      select: workspaceSelect,
    });
  }

  async members(identity: AuthIdentity, workspaceId: string) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async invite(
    identity: AuthIdentity,
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ) {
    const userId = await this.userId(identity);
    const member = await this.access.require(
      workspaceId,
      userId,
      WorkspaceRole.ADMIN,
    );
    if (
      role === WorkspaceRole.OWNER ||
      (role === WorkspaceRole.ADMIN && member.role !== WorkspaceRole.OWNER)
    ) {
      throw new ForbiddenException('Cannot invite this role');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: normalizedEmail,
        role,
        tokenHash,
        expiresAt,
        invitedBy: userId,
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    return { ...invitation, token };
  }

  async invitations(identity: AuthIdentity, workspaceId: string) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.ADMIN);
    return this.prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(
    identity: AuthIdentity,
    workspaceId: string,
    invitationId: string,
  ) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.ADMIN);
    const result = await this.prisma.workspaceInvitation.updateMany({
      where: {
        id: invitationId,
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Invitation not found');
    return { revoked: true };
  }

  async changeRole(
    identity: AuthIdentity,
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.OWNER);
    if (role === WorkspaceRole.OWNER)
      throw new ForbiddenException('Use ownership transfer');
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!membership) throw new NotFoundException('Member not found');
    if (membership.role === WorkspaceRole.OWNER)
      throw new ForbiddenException('Cannot change owner role');
    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
  }

  async removeMember(
    identity: AuthIdentity,
    workspaceId: string,
    memberId: string,
  ) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.OWNER);
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!membership) throw new NotFoundException('Member not found');
    if (membership.role === WorkspaceRole.OWNER)
      throw new ForbiddenException('Cannot remove owner');
    await this.removeMembership(workspaceId, membership.userId);
    return { removed: true };
  }

  private async removeMembership(workspaceId: string, userId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.taskAssignee.deleteMany({
            where: { userId, task: { board: { project: { workspaceId } } } },
          });
          await tx.workspaceMember.delete({
            where: { workspaceId_userId: { workspaceId, userId } },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      this.realtime.evictUser(userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException('Membership changed concurrently');
      throw error;
    }
  }

  async archive(identity: AuthIdentity, workspaceId: string) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.OWNER);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { archivedAt: new Date() },
    });
    this.realtime.evictWorkspace(workspaceId);
    return { archived: true };
  }

  async accept(identity: AuthIdentity, token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: { workspace: { select: { archivedAt: true } } },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.workspace.archivedAt
    ) {
      throw new NotFoundException('Invitation unavailable');
    }
    if (invitation.email !== identity.email.trim().toLowerCase()) {
      throw new ForbiddenException('Invitation belongs to another account');
    }
    const userId = await this.userId(identity);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const claimed = await tx.workspaceInvitation.updateMany({
              where: {
                id: invitation.id,
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              data: { acceptedAt: new Date() },
            });
            if (claimed.count !== 1)
              throw new ConflictException('Invitation already used');
            await tx.workspaceMember.create({
              data: {
                workspaceId: invitation.workspaceId,
                userId,
                role: invitation.role,
              },
            });
            return tx.workspace.findUniqueOrThrow({
              where: { id: invitation.workspaceId },
              select: workspaceSelect,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw new ConflictException('Already a workspace member');
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < 2) continue;
          throw new ConflictException('Invitation was updated concurrently');
        }
        throw error;
      }
    }
    throw new ConflictException('Invitation was updated concurrently');
  }

  async transferOwnership(
    identity: AuthIdentity,
    workspaceId: string,
    memberId: string,
  ) {
    const userId = await this.userId(identity);
    await this.access.require(workspaceId, userId, WorkspaceRole.OWNER);
    const target = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.userId === userId) throw new ConflictException('Already owner');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.workspace.updateMany({
            where: { id: workspaceId, ownerId: userId, archivedAt: null },
            data: { ownerId: target.userId },
          });
          if (updated.count !== 1)
            throw new ConflictException('Ownership changed concurrently');
          await tx.workspaceMember.update({
            where: {
              workspaceId_userId: { workspaceId, userId: target.userId },
            },
            data: { role: WorkspaceRole.OWNER },
          });
          await tx.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId, userId } },
            data: { role: WorkspaceRole.ADMIN },
          });
          return tx.workspace.findUniqueOrThrow({
            where: { id: workspaceId },
            select: workspaceSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Ownership changed concurrently');
      }
      throw error;
    }
  }

  async leave(identity: AuthIdentity, workspaceId: string) {
    const userId = await this.userId(identity);
    const membership = await this.access.require(workspaceId, userId);
    if (membership.role === WorkspaceRole.OWNER)
      throw new ForbiddenException('Transfer ownership before leaving');
    await this.removeMembership(workspaceId, userId);
    return { left: true };
  }
}
