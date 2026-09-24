import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Global()
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
