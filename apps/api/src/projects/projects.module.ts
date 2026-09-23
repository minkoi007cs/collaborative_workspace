import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import {
  BoardsController,
  ProjectsController,
  WorkspaceProjectsController,
} from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuthModule, UsersModule, WorkspacesModule],
  controllers: [
    WorkspaceProjectsController,
    ProjectsController,
    BoardsController,
  ],
  providers: [ProjectsService],
})
export class ProjectsModule {}
