import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
  ],
})
export class AppModule {}
