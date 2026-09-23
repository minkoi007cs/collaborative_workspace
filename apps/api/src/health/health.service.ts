import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { loadConfig } from '../config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis = new Redis(loadConfig().REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check() {
    const [database, redis] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);
    return {
      status:
        database.status === 'fulfilled' && redis.status === 'fulfilled'
          ? 'ok'
          : 'degraded',
      services: {
        database: database.status === 'fulfilled' ? 'up' : 'down',
        redis: redis.status === 'fulfilled' ? 'up' : 'down',
      },
    } as const;
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
