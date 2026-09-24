import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import {
  CommentsController,
  TaskCommentsController,
} from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuthModule, ProjectsModule, UsersModule],
  controllers: [CommentsController, TaskCommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
