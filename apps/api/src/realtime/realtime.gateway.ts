import { Inject } from '@nestjs/common';
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
import { RealtimePublisher } from './realtime.publisher';

const boardSchema = z.object({ boardId: z.string().uuid() }).strict();
type AuthorizedSocket = Socket & {
  data: { identity: AuthIdentity; userId: string };
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' },
  transports: ['websocket'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly expiryTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(RealtimePublisher) private readonly publisher: RealtimePublisher,
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

  handleDisconnect(client: Socket) {
    const timer = this.expiryTimers.get(client.id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(client.id);
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
      for (const room of client.rooms) {
        if (room.startsWith('board:') || room.startsWith('workspace:'))
          await client.leave(room);
      }
      await client.join(`board:${board.id}`);
      await client.join(`workspace:${board.project.workspaceId}`);
      return { ok: true };
    } catch {
      return { ok: false, error: 'not_found' };
    }
  }

  @SubscribeMessage('board.leave')
  leave(
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
    return { ok: true };
  }
}
