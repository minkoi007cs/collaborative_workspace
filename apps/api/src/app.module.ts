import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    RealtimeModule,
    CommentsModule,
  ],
})
export class AppModule {}
