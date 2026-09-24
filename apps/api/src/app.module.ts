import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CommentsModule } from './comments/comments.module';
import { ActivityModule } from './activity/activity.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';

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
    ActivityModule,
    NotificationsModule,
    SearchModule,
    RateLimitModule,
  ],
})
export class AppModule {}
