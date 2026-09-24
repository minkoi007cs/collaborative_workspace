import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';

function waitFor<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      3000,
    );
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

test('realtime authenticates, isolates rooms, tracks multi-tab presence and revokes membership', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const keyServer = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        keys: [{ ...jwk, kid: 'realtime-key', alg: 'ES256', use: 'sig' }],
      }),
    );
  });
  keyServer.listen(0, '127.0.0.1');
  await once(keyServer, 'listening');
  const keyAddress = keyServer.address();
  assert.ok(keyAddress && typeof keyAddress !== 'string');
  const projectUrl = `http://127.0.0.1:${keyAddress.port}`;
  const oldUrl = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = projectUrl;
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const base = `${origin}/api/v1`;
  const prisma = new PrismaClient();
  const sockets: Socket[] = [];
  let workspaceId: string | undefined;
  const subject = [randomUUID(), randomUUID(), randomUUID()];
  async function token(index: number) {
    return new SignJWT({
      email: `realtime-${index}@example.test`,
      role: 'authenticated',
      is_anonymous: false,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'realtime-key' })
      .setSubject(subject[index])
      .setIssuer(`${projectUrl}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('10m')
      .sign(privateKey);
  }
  async function send(
    path: string,
    bearer: string,
    method = 'GET',
    body?: object,
  ) {
    return fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  function socket(bearer: string) {
    const client = io(`${origin}/realtime`, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
      auth: { token: bearer },
      extraHeaders: {
        Origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      },
    });
    sockets.push(client);
    return client;
  }
  try {
    const owner = await token(0);
    const viewer = await token(1);
    const outsider = await token(2);
    const invalid = socket('invalid');
    const invalidError = waitFor<Error>(invalid, 'connect_error');
    invalid.connect();
    assert.match((await invalidError).message, /Unauthorized/);

    const created = await send('/workspaces', owner, 'POST', {
      name: 'Realtime test',
    });
    assert.equal(created.status, 201);
    workspaceId = ((await created.json()) as { id: string }).id;
    const invitation = await send(
      `/workspaces/${workspaceId}/invitations`,
      owner,
      'POST',
      { email: 'realtime-1@example.test', role: 'VIEWER' },
    );
    assert.equal(invitation.status, 201);
    const invitationToken = ((await invitation.json()) as { token: string })
      .token;
    assert.equal(
      (
        await send('/invitations/accept', viewer, 'POST', {
          token: invitationToken,
        })
      ).status,
      201,
    );
    const projectResponse = await send(
      `/workspaces/${workspaceId}/projects`,
      owner,
      'POST',
      { name: 'Realtime project' },
    );
    assert.equal(projectResponse.status, 201);
    const project = (await projectResponse.json()) as {
      id: string;
      boards: Array<{ id: string; columns: Array<{ id: string }> }>;
    };
    const board = project.boards[0];
    const secondResponse = await send(
      `/projects/${project.id}/boards`,
      owner,
      'POST',
      { name: 'Other board' },
    );
    assert.equal(secondResponse.status, 201);
    const secondBoard = (await secondResponse.json()) as { id: string };

    const stranger = socket(outsider);
    const strangerConnected = waitFor<void>(stranger, 'connect');
    stranger.connect();
    await strangerConnected;
    const denied = await stranger
      .timeout(3000)
      .emitWithAck('board.join', { boardId: board.id });
    assert.deepEqual(denied, { ok: false, error: 'not_found' });

    const watcher = socket(viewer);
    const watcherConnected = waitFor<void>(watcher, 'connect');
    watcher.connect();
    await watcherConnected;
    const viewerJoin = (await watcher
      .timeout(3000)
      .emitWithAck('board.join', { boardId: board.id })) as {
      ok: boolean;
      presence: Array<{ id: string }>;
    };
    assert.equal(viewerJoin.ok, true);
    assert.equal(viewerJoin.presence.length, 1);
    assert.deepEqual(
      await watcher
        .timeout(3000)
        .emitWithAck('board.leave', { boardId: secondBoard.id }),
      { ok: false, error: 'not_joined' },
    );

    const otherWatcher = socket(owner);
    const otherConnected = waitFor<void>(otherWatcher, 'connect');
    otherWatcher.connect();
    await otherConnected;
    const ownerJoin = (await otherWatcher
      .timeout(3000)
      .emitWithAck('board.join', { boardId: secondBoard.id })) as {
      ok: boolean;
      presence: Array<{ id: string }>;
    };
    assert.equal(ownerJoin.ok, true);
    assert.equal(ownerJoin.presence.length, 2);
    let leaked = false;
    otherWatcher.on('task.created', () => {
      leaked = true;
    });
    stranger.on('task.created', () => {
      leaked = true;
    });

    const eventPromise = waitFor<{
      boardId: string;
      entityId: string;
      version: number;
      actorId: string;
      eventId: string;
    }>(watcher, 'task.created');
    const taskResponse = await send(
      `/boards/${board.id}/tasks`,
      owner,
      'POST',
      { title: 'Real-time task', columnId: board.columns[0].id },
    );
    assert.equal(taskResponse.status, 201);
    const task = (await taskResponse.json()) as { id: string };
    const event = await eventPromise;
    assert.equal(event.entityId, task.id);
    assert.equal(event.boardId, board.id);
    assert.equal(event.version, 1);
    assert.ok(event.actorId && event.eventId);
    assert.equal(leaked, false);

    const boardEvent = waitFor<{ boardId: string; version: number }>(
      watcher,
      'board.updated',
    );
    const columnResponse = await send(
      `/boards/${board.id}/columns`,
      owner,
      'POST',
      {
        name: 'Review',
        expectedVersion: 1,
      },
    );
    assert.equal(columnResponse.status, 201);
    assert.equal((await boardEvent).boardId, board.id);
    assert.equal(
      ((await columnResponse.json()) as { version: number }).version,
      2,
    );

    const secondViewer = socket(viewer);
    const secondConnected = waitFor<void>(secondViewer, 'connect');
    secondViewer.connect();
    await secondConnected;
    const secondJoin = (await secondViewer
      .timeout(3000)
      .emitWithAck('board.join', { boardId: board.id })) as {
      ok: boolean;
      presence: Array<{ id: string }>;
    };
    assert.equal(secondJoin.ok, true);
    assert.equal(secondJoin.presence.length, 2);
    const heartbeat = (await secondViewer
      .timeout(3000)
      .emitWithAck('presence.heartbeat')) as {
      ok: boolean;
      presence: Array<{ id: string }>;
    };
    assert.equal(heartbeat.ok, true);
    assert.equal(heartbeat.presence.length, 2);
    let prematureOffline = false;
    otherWatcher.on('presence.offline', () => {
      prematureOffline = true;
    });
    watcher.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(prematureOffline, false);

    const members = (await (
      await send(`/workspaces/${workspaceId}/members`, owner)
    ).json()) as Array<{ id: string; user: { email: string } }>;
    const viewerMember = members.find(
      (member) => member.user.email === 'realtime-1@example.test',
    );
    assert.ok(viewerMember);
    const disconnected = waitFor<string>(secondViewer, 'disconnect');
    const offline = waitFor<{ entityId: string }>(
      otherWatcher,
      'presence.offline',
    );
    assert.equal(
      (
        await send(
          `/workspaces/${workspaceId}/members/${viewerMember.id}`,
          owner,
          'DELETE',
        )
      ).status,
      200,
    );
    await disconnected;
    assert.equal(secondViewer.connected, false);
    assert.ok((await offline).entityId);
    const archivedSocket = waitFor<string>(otherWatcher, 'disconnect');
    assert.equal(
      (await send(`/projects/${project.id}`, owner, 'DELETE')).status,
      200,
    );
    await archivedSocket;
  } finally {
    sockets.forEach((client) => {
      client.disconnect();
    });
    if (workspaceId)
      await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { authSubject: { in: subject } } });
    await prisma.$disconnect();
    await app.close();
    keyServer.close();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
  }
});
