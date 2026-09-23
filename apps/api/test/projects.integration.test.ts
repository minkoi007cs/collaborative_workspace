import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module';

test('projects and boards enforce lineage, roles, and column versions', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const keyServer = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        keys: [{ ...jwk, kid: 'project-key', alg: 'ES256', use: 'sig' }],
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
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const prisma = new PrismaClient();
  const subjects = [randomUUID(), randomUUID(), randomUUID()];
  let workspaceId: string | undefined;

  async function token(subject: string, email: string) {
    return new SignJWT({ email, role: 'authenticated', is_anonymous: false })
      .setProtectedHeader({ alg: 'ES256', kid: 'project-key' })
      .setSubject(subject)
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

  try {
    const owner = await token(subjects[0], 'project-owner@example.test');
    const viewer = await token(subjects[1], 'project-viewer@example.test');
    const outsider = await token(subjects[2], 'project-outsider@example.test');
    const created = await send('/workspaces', owner, 'POST', {
      name: 'Project test',
    });
    assert.equal(created.status, 201);
    workspaceId = ((await created.json()) as { id: string }).id;
    const invitationResponse = await send(
      `/workspaces/${workspaceId}/invitations`,
      owner,
      'POST',
      { email: 'project-viewer@example.test', role: 'VIEWER' },
    );
    assert.equal(invitationResponse.status, 201);
    const invitation = (await invitationResponse.json()) as { token: string };
    assert.equal(
      (
        await send('/invitations/accept', viewer, 'POST', {
          token: invitation.token,
        })
      ).status,
      201,
    );

    assert.equal(
      (
        await send(`/workspaces/${workspaceId}/projects`, viewer, 'POST', {
          name: 'Denied',
        })
      ).status,
      403,
    );
    const projectResponse = await send(
      `/workspaces/${workspaceId}/projects`,
      owner,
      'POST',
      { name: 'Release plan', description: 'Scope' },
    );
    assert.equal(projectResponse.status, 201);
    const project = (await projectResponse.json()) as {
      id: string;
      boards: Array<{
        id: string;
        version: number;
        columns: Array<{ id: string; name: string }>;
      }>;
    };
    assert.equal(project.boards.length, 1);
    assert.deepEqual(
      project.boards[0].columns.map((column) => column.name),
      ['To do', 'In progress', 'Done'],
    );
    const board = project.boards[0];
    assert.equal((await send(`/projects/${project.id}`, outsider)).status, 404);
    assert.equal((await send(`/boards/${board.id}`, outsider)).status, 404);
    assert.equal((await send(`/boards/${board.id}`, viewer)).status, 200);
    assert.equal(
      (
        await send(`/boards/${board.id}/columns`, viewer, 'POST', {
          name: 'Review',
          expectedVersion: 1,
        })
      ).status,
      403,
    );
    const addedResponse = await send(
      `/boards/${board.id}/columns`,
      owner,
      'POST',
      { name: 'Review', expectedVersion: 1 },
    );
    assert.equal(addedResponse.status, 201);
    const added = (await addedResponse.json()) as typeof board;
    assert.equal(added.version, 2);
    assert.equal(added.columns.length, 4);
    assert.equal(
      (
        await send(`/boards/${board.id}/columns`, owner, 'POST', {
          name: 'Stale',
          expectedVersion: 1,
        })
      ).status,
      409,
    );
    const reversed = added.columns.map((column) => column.id).reverse();
    const orderedResponse = await send(
      `/boards/${board.id}/columns/order`,
      owner,
      'PUT',
      { expectedVersion: 2, columnIds: reversed },
    );
    assert.equal(orderedResponse.status, 200);
    const ordered = (await orderedResponse.json()) as typeof board;
    assert.deepEqual(
      ordered.columns.map((column) => column.id),
      reversed,
    );
    assert.equal(
      (
        await send(`/boards/${board.id}/columns/order`, owner, 'PUT', {
          expectedVersion: 3,
          columnIds: [reversed[0]],
        })
      ).status,
      409,
    );
    assert.equal(
      (await send(`/projects/${project.id}`, viewer, 'DELETE')).status,
      403,
    );
    assert.equal(
      (await send(`/projects/${project.id}`, owner, 'DELETE')).status,
      200,
    );
    assert.equal((await send(`/boards/${board.id}`, owner)).status, 404);
  } finally {
    if (workspaceId)
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { authSubject: { in: subjects } } });
    await prisma.$disconnect();
    await app.close();
    keyServer.close();
    process.env.SUPABASE_URL = oldUrl;
  }
});
