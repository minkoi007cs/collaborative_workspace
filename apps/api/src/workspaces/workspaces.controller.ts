import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ActivityType, WorkspaceRole } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import { ActivityService } from '../activity/activity.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
import { WorkspacesService } from './workspaces.service';

const nameSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();
const inviteSchema = z
  .object({
    email: z.string().trim().email().max(320),
    role: z
      .nativeEnum(WorkspaceRole)
      .refine((role) => role !== WorkspaceRole.OWNER),
  })
  .strict();
const roleSchema = z.object({ role: z.nativeEnum(WorkspaceRole) }).strict();
const acceptSchema = z
  .object({ token: z.string().regex(/^[a-zA-Z0-9_-]{43}$/) })
  .strict();

function parse<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}

function identity(request: AuthenticatedRequest): AuthIdentity {
  if (!request.auth) throw new Error('AuthGuard did not attach identity');
  return request.auth;
}

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(ActivityService) private readonly activity: ActivityService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.workspaces.list(identity(request));
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const auth = identity(request);
    const workspace = await this.workspaces.create(
      auth,
      parse(nameSchema, body).name,
    );
    await this.activity.recordWorkspace(
      auth,
      workspace.id,
      'workspace',
      workspace.id,
      ActivityType.WORKSPACE_CREATED,
      { name: workspace.name },
    );
    return workspace;
  }

  @Get(':workspaceId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.get(identity(request), workspaceId);
  }

  @Patch(':workspaceId')
  async rename(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const workspace = await this.workspaces.rename(
      auth,
      workspaceId,
      parse(nameSchema, body).name,
    );
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'workspace',
      workspaceId,
      ActivityType.WORKSPACE_RENAMED,
      { name: workspace.name },
    );
    return workspace;
  }

  @Get(':workspaceId/members')
  members(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.members(identity(request), workspaceId);
  }

  @Patch(':workspaceId/members/:memberId')
  async changeRole(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: unknown,
  ) {
    const auth = identity(request);
    const member = await this.workspaces.changeRole(
      auth,
      workspaceId,
      memberId,
      parse(roleSchema, body).role,
    );
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'member',
      memberId,
      ActivityType.MEMBER_ROLE_CHANGED,
      { role: member.role },
    );
    return member;
  }

  @Post(':workspaceId/transfer-ownership')
  async transferOwnership(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z.object({ memberId: z.string().uuid() }).strict(),
      body,
    );
    const auth = identity(request);
    const result = await this.workspaces.transferOwnership(
      auth,
      workspaceId,
      input.memberId,
    );
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'workspace',
      workspaceId,
      ActivityType.OWNER_TRANSFERRED,
      { memberId: input.memberId },
    );
    return result;
  }

  @Delete(':workspaceId/members/me')
  async leave(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    const auth = identity(request);
    const result = await this.workspaces.leave(auth, workspaceId);
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'workspace',
      workspaceId,
      ActivityType.MEMBER_REMOVED,
    );
    return result;
  }

  @Delete(':workspaceId/members/:memberId')
  async removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    const auth = identity(request);
    const result = await this.workspaces.removeMember(
      auth,
      workspaceId,
      memberId,
    );
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'member',
      memberId,
      ActivityType.MEMBER_REMOVED,
    );
    return result;
  }

  @Get(':workspaceId/invitations')
  invitations(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.invitations(identity(request), workspaceId);
  }

  @Post(':workspaceId/invitations')
  async invite(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    const input = parse(inviteSchema, body);
    const auth = identity(request);
    await this.rateLimit.check(
      auth,
      'invite-create',
      20,
      60 * 60 * 1000,
      workspaceId,
    );
    const invitation = await this.workspaces.invite(
      auth,
      workspaceId,
      input.email,
      input.role,
    );
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'workspace',
      workspaceId,
      ActivityType.MEMBER_INVITED,
      { role: input.role },
    );
    return invitation;
  }

  @Delete(':workspaceId/invitations/:invitationId')
  revokeInvitation(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.workspaces.revokeInvitation(
      identity(request),
      workspaceId,
      invitationId,
    );
  }

  @Delete(':workspaceId')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    const auth = identity(request);
    const result = await this.workspaces.archive(auth, workspaceId);
    await this.activity.recordWorkspace(
      auth,
      workspaceId,
      'workspace',
      workspaceId,
      ActivityType.WORKSPACE_ARCHIVED,
    );
    return result;
  }
}

@Controller('invitations')
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Post('accept')
  async accept(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const auth = identity(request);
    const input = parse(acceptSchema, body);
    await this.rateLimit.check(auth, 'invite-accept', 10, 5 * 60 * 1000);
    return this.workspaces.accept(auth, input.token);
  }
}
