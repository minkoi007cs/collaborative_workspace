import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisher } from './realtime.publisher';

@Global()
@Module({
  imports: [AuthModule, UsersModule, ProjectsModule],
  providers: [RealtimePublisher, RealtimeGateway],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
