import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private publisher?: Redis;
  private subscriber?: Redis;

  async connect(url: string) {
    const publisher = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    const subscriber = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([publisher.connect(), subscriber.connect()]),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Redis Socket.IO connection timed out')),
            5000,
          );
        }),
      ]);
      this.publisher = publisher;
      this.subscriber = subscriber;
    } catch (error) {
      publisher.disconnect();
      subscriber.disconnect();
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    if (!this.publisher || !this.subscriber)
      throw new Error('Redis Socket.IO adapter is not connected');
    const server = super.createIOServer(port, options) as Server;
    server.adapter(createAdapter(this.publisher, this.subscriber));
    return server;
  }

  override async dispose() {
    this.publisher?.disconnect();
    this.subscriber?.disconnect();
  }
}
