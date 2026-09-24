import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { loadConfig } from '../config';

const lifetimeMs = 90_000;
const joinScript = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local before = redis.call('ZCARD', KEYS[1])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
redis.call('ZADD', KEYS[2], 'GT', ARGV[2], ARGV[5])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
return before
`;
const leaveScript = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
redis.call('ZREM', KEYS[1], ARGV[2])
local latest = redis.call('ZREVRANGE', KEYS[1], 0, 0, 'WITHSCORES')
if #latest == 0 then
  redis.call('ZREM', KEYS[2], ARGV[3])
  return 0
end
redis.call('ZADD', KEYS[2], latest[2], ARGV[3])
return redis.call('ZCARD', KEYS[1])
`;

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis = new Redis(loadConfig().REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private keys(workspaceId: string, userId: string) {
    const prefix = `presence:{${workspaceId}}`;
    return [`${prefix}:user:${userId}`, `${prefix}:users`];
  }

  async join(workspaceId: string, userId: string, socketId: string) {
    const now = Date.now();
    const count = await this.redis.eval(
      joinScript,
      2,
      ...this.keys(workspaceId, userId),
      now,
      now + lifetimeMs,
      lifetimeMs * 2,
      socketId,
      userId,
    );
    return Number(count) === 0;
  }

  async heartbeat(workspaceId: string, userId: string, socketId: string) {
    return this.join(workspaceId, userId, socketId);
  }

  async leave(workspaceId: string, userId: string, socketId: string) {
    const remaining = await this.redis.eval(
      leaveScript,
      2,
      ...this.keys(workspaceId, userId),
      Date.now(),
      socketId,
      userId,
    );
    return Number(remaining) === 0;
  }

  async snapshot(workspaceId: string) {
    const usersKey = this.keys(workspaceId, '')[1];
    const now = Date.now();
    await this.redis.zremrangebyscore(usersKey, '-inf', now);
    const userIds = await this.redis.zrange(usersKey, 0, -1);
    if (userIds.length === 0) return [];
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: userIds } },
      select: { user: { select: { id: true, displayName: true } } },
    });
    return members.map((member) => member.user);
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.warn(
        `Redis shutdown: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.redis.disconnect();
    }
  }
}
