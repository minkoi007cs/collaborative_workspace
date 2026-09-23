import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WorkspaceAccessService } from './workspace-access.service';
import {
  InvitationsController,
  WorkspacesController,
} from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [WorkspacesController, InvitationsController],
  providers: [WorkspaceAccessService, WorkspacesService],
  exports: [WorkspaceAccessService],
})
export class WorkspacesModule {}
