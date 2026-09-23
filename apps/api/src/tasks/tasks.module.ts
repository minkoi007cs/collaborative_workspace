import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import {
  BoardsTasksController,
  ProjectLabelsController,
  TasksController,
} from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuthModule, UsersModule, ProjectsModule],
  controllers: [
    BoardsTasksController,
    TasksController,
    ProjectLabelsController,
  ],
  providers: [TasksService],
})
export class TasksModule {}
