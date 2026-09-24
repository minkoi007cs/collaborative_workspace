import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import type { AuthIdentity } from '../auth/auth.types';
import { loadConfig } from '../config';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { PresenceService } from './presence.service';
import { RealtimePublisher } from './realtime.publisher';

const boardSchema = z.object({ boardId: z.string().uuid() }).strict();
type AuthorizedSocket = Socket & {
  data: {
    identity: AuthIdentity;
    userId: string;
    displayName: string;
    workspaceId?: string;
    boardId?: string;
    lastHeartbeat?: number;
    presenceRegistered?: boolean;
  };
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' },
  transports: ['websocket'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly expiryTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(RealtimePublisher) private readonly publisher: RealtimePublisher,
    @Inject(PresenceService) private readonly presence: PresenceService,
  ) {}

  afterInit(namespace: Namespace) {
    this.publisher.attach(namespace);
    namespace.use(async (socket, next) => {
      try {
        const origin = socket.handshake.headers.origin;
        if (origin && origin !== loadConfig().WEB_ORIGIN)
          throw new Error('Invalid origin');
        const token: unknown = socket.handshake.auth?.token;
        if (typeof token !== 'string' || token.length > 8192)
          throw new Error('Missing token');
        const identity = await this.auth.verifyAccessToken(token);
        const user = await this.users.getOrCreate(identity);
        socket.data.identity = identity;
        socket.data.userId = user.id;
        socket.data.displayName = user.displayName;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: AuthorizedSocket) {
    client.join(`user:${client.data.userId}`);
    const delay = Math.max(
      1,
      Math.min(client.data.identity.expiresAt * 1000 - Date.now(), 2147483647),
    );
    const timer = setTimeout(() => client.disconnect(true), delay);
    this.expiryTimers.set(client.id, timer);
  }

  async handleDisconnect(client: AuthorizedSocket) {
    const timer = this.expiryTimers.get(client.id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(client.id);
    await this.dropPresence(client);
  }

  private async dropPresence(client: AuthorizedSocket) {
    const workspaceId = client.data.workspaceId;
    if (!workspaceId) return;
    const registered = client.data.presenceRegistered;
    client.data.workspaceId = undefined;
    client.data.boardId = undefined;
    client.data.presenceRegistered = false;
    if (!registered) return;
    try {
      const offline = await this.presence.leave(
        workspaceId,
        client.data.userId,
        client.id,
      );
      if (offline)
        this.publisher.publishPresence(
          'presence.offline',
          workspaceId,
          client.data.userId,
          client.data.displayName,
        );
    } catch (error) {
      this.logger.warn(
        `Presence leave failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  @SubscribeMessage('board.join')
  async join(
    @ConnectedSocket() client: AuthorizedSocket,
    @MessageBody() payload: unknown,
  ) {
    const input = boardSchema.safeParse(payload);
    if (!input.success) return { ok: false, error: 'invalid_board' };
    try {
      const board = await this.projects.requireBoard(
        client.data.identity,
        input.data.boardId,
      );
      const workspaceId = board.project.workspaceId;
      if (client.data.workspaceId && client.data.workspaceId !== workspaceId)
        await this.dropPresence(client);
      for (const room of client.rooms) {
        if (room.startsWith('board:') || room.startsWith('workspace:'))
          await client.leave(room);
      }
      await client.join(`board:${board.id}`);
      await client.join(`workspace:${workspaceId}`);
      client.data.workspaceId = workspaceId;
      client.data.boardId = board.id;
      try {
        const online = await this.presence.join(
          workspaceId,
          client.data.userId,
          client.id,
        );
        client.data.presenceRegistered = true;
        if (online)
          this.publisher.publishPresence(
            'presence.online',
            workspaceId,
            client.data.userId,
            client.data.displayName,
          );
        return {
          ok: true,
          presence: await this.presence.snapshot(workspaceId),
          presenceAvailable: true,
        };
      } catch (error) {
        this.logger.warn(
          `Presence join failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        return { ok: true, presence: [], presenceAvailable: false };
      }
    } catch {
      return { ok: false, error: 'not_found' };
    }
  }

  @SubscribeMessage('board.leave')
  async leave(
    @ConnectedSocket() client: AuthorizedSocket,
    @MessageBody() payload: unknown,
  ) {
    const input = boardSchema.safeParse(payload);
    if (!input.success) return { ok: false, error: 'invalid_board' };
    if (!client.rooms.has(`board:${input.data.boardId}`))
      return { ok: false, error: 'not_joined' };
    for (const room of client.rooms) {
      if (room.startsWith('board:') || room.startsWith('workspace:'))
        client.leave(room);
    }
    await this.dropPresence(client);
    return { ok: true };
  }

  @SubscribeMessage('presence.heartbeat')
  async heartbeat(@ConnectedSocket() client: AuthorizedSocket) {
    const boardId = client.data.boardId;
    const workspaceId = client.data.workspaceId;
    if (!boardId || !workspaceId) return { ok: false, error: 'not_joined' };
    if (Date.now() - (client.data.lastHeartbeat ?? 0) < 10_000)
      return { ok: true };
    try {
      await this.projects.requireBoard(client.data.identity, boardId);
    } catch {
      client.disconnect(true);
      return { ok: false, error: 'unauthorized' };
    }
    try {
      const online = await this.presence.heartbeat(
        workspaceId,
        client.data.userId,
        client.id,
      );
      client.data.presenceRegistered = true;
      client.data.lastHeartbeat = Date.now();
      if (online)
        this.publisher.publishPresence(
          'presence.online',
          workspaceId,
          client.data.userId,
          client.data.displayName,
        );
      return { ok: true, presence: await this.presence.snapshot(workspaceId) };
    } catch (error) {
      this.logger.warn(
        `Presence heartbeat failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { ok: false, error: 'presence_unavailable' };
    }
  }
}
