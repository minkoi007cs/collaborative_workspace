import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import type { AuthIdentity } from '../auth/auth.types';
import { loadConfig } from '../config';

const countScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count
`;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis = new Redis(loadConfig().REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  async check(
    identity: AuthIdentity,
    action: 'invite-create' | 'invite-accept' | 'attachment-upload',
    limit: number,
    windowMs: number,
    scope = 'global',
  ) {
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rate:${action}:${identity.subject}:${scope}:${bucket}`;
    let count: number;
    try {
      count = Number(await this.redis.eval(countScript, 1, key, windowMs * 2));
    } catch (error) {
      this.logger.warn(
        `Rate limit check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException('Rate limit unavailable');
    }
    if (count > limit) throw new HttpException('Rate limit exceeded', 429);
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
