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
import { WorkspaceRole } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
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
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.workspaces.list(identity(request));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.workspaces.create(
      identity(request),
      parse(nameSchema, body).name,
    );
  }

  @Get(':workspaceId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.get(identity(request), workspaceId);
  }

  @Patch(':workspaceId')
  rename(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.workspaces.rename(
      identity(request),
      workspaceId,
      parse(nameSchema, body).name,
    );
  }

  @Get(':workspaceId/members')
  members(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.members(identity(request), workspaceId);
  }

  @Patch(':workspaceId/members/:memberId')
  changeRole(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: unknown,
  ) {
    return this.workspaces.changeRole(
      identity(request),
      workspaceId,
      memberId,
      parse(roleSchema, body).role,
    );
  }

  @Post(':workspaceId/transfer-ownership')
  transferOwnership(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z.object({ memberId: z.string().uuid() }).strict(),
      body,
    );
    return this.workspaces.transferOwnership(
      identity(request),
      workspaceId,
      input.memberId,
    );
  }

  @Delete(':workspaceId/members/me')
  leave(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.leave(identity(request), workspaceId);
  }

  @Delete(':workspaceId/members/:memberId')
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.workspaces.removeMember(
      identity(request),
      workspaceId,
      memberId,
    );
  }

  @Get(':workspaceId/invitations')
  invitations(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.invitations(identity(request), workspaceId);
  }

  @Post(':workspaceId/invitations')
  invite(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    const input = parse(inviteSchema, body);
    return this.workspaces.invite(
      identity(request),
      workspaceId,
      input.email,
      input.role,
    );
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
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.archive(identity(request), workspaceId);
  }
}

@Controller('invitations')
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}

  @Post('accept')
  accept(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.workspaces.accept(
      identity(request),
      parse(acceptSchema, body).token,
    );
  }
}
