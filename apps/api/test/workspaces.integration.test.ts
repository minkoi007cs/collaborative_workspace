import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module';

test('workspace roles, invitation acceptance, ownership, and archive are enforced', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const jwks = JSON.stringify({
    keys: [{ ...jwk, kid: 'workspace-key', alg: 'ES256', use: 'sig' }],
  });
  const keyServer = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(jwks);
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
  const ownerSubject = randomUUID();
  const guestSubject = randomUUID();
  const otherSubject = randomUUID();
  let workspaceId: string | undefined;

  async function token(subject: string, email: string) {
    return new SignJWT({ email, role: 'authenticated', is_anonymous: false })
      .setProtectedHeader({ alg: 'ES256', kid: 'workspace-key' })
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
    const owner = await token(ownerSubject, 'owner@example.test');
    const guest = await token(guestSubject, 'guest@example.test');
    const other = await token(otherSubject, 'other@example.test');
    const created = await send('/workspaces', owner, 'POST', {
      name: '  Team Atlas  ',
    });
    assert.equal(created.status, 201);
    const workspace = (await created.json()) as { id: string; name: string };
    workspaceId = workspace.id;
    assert.equal(workspace.name, 'Team Atlas');
    assert.equal(
      (await send(`/workspaces/${workspace.id}`, other)).status,
      404,
    );
    assert.equal(
      (
        await send(`/workspaces/${workspace.id}`, guest, 'PATCH', {
          name: 'No',
        })
      ).status,
      404,
    );

    const invited = await send(
      `/workspaces/${workspace.id}/invitations`,
      owner,
      'POST',
      {
        email: 'guest@example.test',
        role: 'VIEWER',
      },
    );
    assert.equal(invited.status, 201);
    assert.equal(invited.headers.get('cache-control'), 'private, no-store');
    const invitation = (await invited.json()) as { id: string; token: string };
    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    assert.equal(
      stored.tokenHash,
      createHash('sha256').update(invitation.token).digest('hex'),
    );
    assert.equal(
      (
        await send('/invitations/accept', other, 'POST', {
          token: invitation.token,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send('/invitations/accept', guest, 'POST', {
          token: invitation.token,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await send('/invitations/accept', guest, 'POST', {
          token: invitation.token,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await send(`/workspaces/${workspace.id}`, guest, 'PATCH', {
          name: 'No',
        })
      ).status,
      403,
    );

    const membersResponse = await send(
      `/workspaces/${workspace.id}/members`,
      owner,
    );
    assert.equal(membersResponse.status, 200);
    const members = (await membersResponse.json()) as Array<{
      id: string;
      role: string;
      user: { email: string };
    }>;
    const guestMember = members.find(
      (member) => member.user.email === 'guest@example.test',
    );
    assert.ok(guestMember);
    assert.equal(guestMember.role, 'VIEWER');
    assert.equal(
      (
        await send(
          `/workspaces/${workspace.id}/members/${guestMember.id}`,
          guest,
          'PATCH',
          { role: 'ADMIN' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await send(
          `/workspaces/${workspace.id}/members/${guestMember.id}`,
          owner,
          'PATCH',
          { role: 'EDITOR' },
        )
      ).status,
      200,
    );
    const roleInbox = (await (await send('/notifications', guest)).json()) as {
      items: Array<{ type: string; taskId: string | null }>;
    };
    assert.ok(
      roleInbox.items.some(
        (item) => item.type === 'ROLE_CHANGED' && item.taskId === null,
      ),
    );
    assert.equal(
      (
        await send(
          `/workspaces/${workspace.id}/transfer-ownership`,
          owner,
          'POST',
          { memberId: guestMember.id },
        )
      ).status,
      201,
    );
    assert.equal(
      (await send(`/workspaces/${workspace.id}/members/me`, guest, 'DELETE'))
        .status,
      403,
    );
    assert.equal(
      (await send(`/workspaces/${workspace.id}`, owner, 'DELETE')).status,
      403,
    );
    assert.equal(
      (await send(`/workspaces/${workspace.id}`, guest, 'DELETE')).status,
      200,
    );
    assert.equal(
      (await send(`/workspaces/${workspace.id}`, owner)).status,
      404,
    );
  } finally {
    if (workspaceId)
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: {
        authSubject: { in: [ownerSubject, guestSubject, otherSubject] },
      },
    });
    await prisma.$disconnect();
    await app.close();
    keyServer.close();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
  }
});
