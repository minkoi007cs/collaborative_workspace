import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule, ProjectsModule, UsersModule, WorkspacesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, StorageService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
