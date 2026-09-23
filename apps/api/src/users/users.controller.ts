import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest, AuthIdentity } from '../auth/auth.types';
import { UsersService } from './users.service';

const updateProfileSchema = z
  .object({ displayName: z.string().trim().min(1).max(80) })
  .strict();

function identityFrom(request: AuthenticatedRequest): AuthIdentity {
  if (!request.auth) throw new UnauthorizedException();
  return request.auth;
}

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.users.getOrCreate(identityFrom(request));
  }

  @Patch('me')
  updateMe(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid profile');
    return this.users.updateProfile(
      identityFrom(request),
      parsed.data.displayName,
    );
  }
}
