import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentStatus, WorkspaceRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { UsersService } from '../users/users.service';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { StorageService, maxAttachmentSize } from './storage.service';

const attachmentSelect = {
  id: true,
  taskId: true,
  fileName: true,
  contentType: true,
  size: true,
  status: true,
  createdAt: true,
  uploadedAt: true,
  uploader: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(WorkspaceAccessService)
    private readonly access: WorkspaceAccessService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  private async scope(
    identity: AuthIdentity,
    taskId: string,
    minimum: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, archivedAt: null },
      select: { boardId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    const board = await this.projects.requireBoard(
      identity,
      task.boardId,
      minimum,
    );
    return board.project.workspaceId;
  }

  async list(identity: AuthIdentity, taskId: string) {
    await this.scope(identity, taskId);
    return this.prisma.attachment.findMany({
      where: { taskId, status: AttachmentStatus.READY },
      select: attachmentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
  }

  async requestUpload(
    identity: AuthIdentity,
    taskId: string,
    input: { fileName: string; contentType: string; size: number },
  ) {
    const workspaceId = await this.scope(
      identity,
      taskId,
      WorkspaceRole.EDITOR,
    );
    await this.rateLimit.check(
      identity,
      'attachment-upload',
      20,
      60 * 60 * 1000,
      taskId,
    );
    const uploaderId = (await this.users.getOrCreate(identity)).id;
    const id = randomUUID();
    const storagePath = `${workspaceId}/${taskId}/${id}`;
    const attachment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId}::uuid FOR UPDATE`;
      const reservedCount = await tx.attachment.count({ where: { taskId } });
      if (reservedCount >= 20)
        throw new BadRequestException('Task has reached the attachment limit');
      return tx.attachment.create({
        data: {
          id,
          taskId,
          uploaderId,
          fileName: input.fileName,
          contentType: input.contentType,
          size: input.size,
          storagePath,
        },
        select: attachmentSelect,
      });
    });
    try {
      const signedUrl = await this.storage.signUpload(storagePath);
      return { attachment, signedUrl };
    } catch (error) {
      await this.prisma.attachment
        .delete({ where: { id } })
        .catch(() => undefined);
      throw error;
    }
  }

  async finalize(identity: AuthIdentity, taskId: string, attachmentId: string) {
    await this.scope(identity, taskId, WorkspaceRole.EDITOR);
    const userId = (await this.users.getOrCreate(identity)).id;
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId)
      throw new ForbiddenException('Only the uploader can finish this upload');
    if (attachment.status === AttachmentStatus.READY)
      return this.prisma.attachment.findUniqueOrThrow({
        where: { id: attachmentId },
        select: attachmentSelect,
      });
    const info = await this.storage.info(attachment.storagePath);
    if (
      !Number.isInteger(info.size) ||
      info.size !== attachment.size ||
      info.size > maxAttachmentSize ||
      info.contentType !== attachment.contentType
    ) {
      await this.storage
        .remove(attachment.storagePath)
        .catch((error) =>
          this.logger.warn(
            `Rejected attachment cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          ),
        );
      throw new BadRequestException('Uploaded file metadata does not match');
    }
    const updated = await this.prisma.attachment.updateMany({
      where: { id: attachmentId, status: AttachmentStatus.PENDING },
      data: { status: AttachmentStatus.READY, uploadedAt: new Date() },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        'Attachment status changed; refresh and try again',
      );
    return this.prisma.attachment.findUniqueOrThrow({
      where: { id: attachmentId },
      select: attachmentSelect,
    });
  }

  async download(identity: AuthIdentity, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        taskId: true,
        fileName: true,
        storagePath: true,
        status: true,
      },
    });
    if (!attachment || attachment.status !== AttachmentStatus.READY)
      throw new NotFoundException('Attachment not found');
    await this.scope(identity, attachment.taskId);
    return {
      url: await this.storage.signDownload(
        attachment.storagePath,
        attachment.fileName,
      ),
    };
  }

  async remove(identity: AuthIdentity, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { taskId: true, uploaderId: true, storagePath: true },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const workspaceId = await this.scope(
      identity,
      attachment.taskId,
      WorkspaceRole.EDITOR,
    );
    const userId = (await this.users.getOrCreate(identity)).id;
    const membership = await this.access.require(workspaceId, userId);
    if (
      attachment.uploaderId !== userId &&
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    )
      throw new ForbiddenException(
        'Only the uploader or an admin can delete this attachment',
      );
    await this.storage.remove(attachment.storagePath);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    return { deleted: true };
  }

  async pathsForTask(taskId: string) {
    const rows = await this.prisma.attachment.findMany({
      where: { taskId },
      select: { storagePath: true },
    });
    return rows.map((row) => row.storagePath);
  }

  async cleanupDeletedTask(paths: string[]) {
    for (const path of paths)
      await this.storage
        .remove(path)
        .catch((error) =>
          this.logger.warn(
            `Deleted task attachment cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          ),
        );
  }
}
