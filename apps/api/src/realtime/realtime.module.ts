import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisher } from './realtime.publisher';
import { PresenceService } from './presence.service';

@Global()
@Module({
  imports: [AuthModule, UsersModule, ProjectsModule],
  providers: [RealtimePublisher, RealtimeGateway, PresenceService],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
