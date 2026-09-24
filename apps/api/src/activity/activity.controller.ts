import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ActivityService } from './activity.service';

function cursor(value?: string) {
  if (value && !z.string().uuid().safeParse(value).success)
    throw new BadRequestException('Invalid cursor');
  return value;
}

@Controller()
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get('workspaces/:workspaceId/activity')
  workspace(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('cursor') pageCursor?: string,
  ) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    return this.activity.workspace(
      request.auth,
      workspaceId,
      cursor(pageCursor),
    );
  }

  @Get('tasks/:taskId/activity')
  task(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('cursor') pageCursor?: string,
  ) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    return this.activity.task(request.auth, taskId, cursor(pageCursor));
  }
}
