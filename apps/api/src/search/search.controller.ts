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
import { TaskPriority } from '@prisma/client';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { SearchService } from './search.service';

const querySchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    page: z.coerce.number().int().min(1).max(10).default(1),
    projectId: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().uuid().optional(),
    ),
    assigneeId: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().uuid().optional(),
    ),
    priority: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.nativeEnum(TaskPriority).optional(),
    ),
  })
  .strict();

@Controller('workspaces/:workspaceId/search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}

  @Get()
  tasks(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: unknown,
  ) {
    if (!request.auth) throw new Error('AuthGuard did not attach identity');
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid search query');
    return this.search.tasks(request.auth, workspaceId, parsed.data);
  }
}
