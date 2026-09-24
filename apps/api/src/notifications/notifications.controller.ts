import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('cursor') cursor?: string) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    if (cursor && !z.string().uuid().safeParse(cursor).success)
      throw new BadRequestException('Invalid cursor');
    return this.notifications.list(request.auth, cursor);
  }

  @Get('unread-count')
  count(@Req() request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    return this.notifications.count(request.auth);
  }

  @Patch(':notificationId/read')
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    return this.notifications.markRead(request.auth, notificationId);
  }

  @Post('read-all')
  markAllRead(@Req() request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    return this.notifications.markAllRead(request.auth);
  }
}
