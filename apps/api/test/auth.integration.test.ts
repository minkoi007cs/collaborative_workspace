import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module';

test('protected profile rejects missing and forged tokens and saves verified identity', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const jwks = JSON.stringify({
    keys: [{ ...jwk, kid: 'test-key', alg: 'ES256', use: 'sig' }],
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
  const url = `http://127.0.0.1:${address.port}/api/v1/users/me`;
  const subject = randomUUID();
  const prisma = new PrismaClient();

  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Authorization: 'Bearer invalid' } }))
        .status,
      401,
    );

    const token = await new SignJWT({
      email: 'alice@example.test',
      role: 'authenticated',
      is_anonymous: false,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(subject)
      .setIssuer(`${projectUrl}/auth/v1`)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(privateKey);

    const headers = { Authorization: `Bearer ${token}` };
    const wrongAudience = await new SignJWT({
      email: 'alice@example.test',
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(subject)
      .setIssuer(`${projectUrl}/auth/v1`)
      .setAudience('other-service')
      .setExpirationTime('10m')
      .sign(privateKey);
    assert.equal(
      (
        await fetch(url, {
          headers: { Authorization: `Bearer ${wrongAudience}` },
        })
      ).status,
      401,
    );
    const noExpiry = await new SignJWT({
      email: 'alice@example.test',
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(subject)
      .setIssuer(`${projectUrl}/auth/v1`)
      .setAudience('authenticated')
      .sign(privateKey);
    assert.equal(
      (await fetch(url, { headers: { Authorization: `Bearer ${noExpiry}` } }))
        .status,
      401,
    );
    const expired = await new SignJWT({
      email: 'alice@example.test',
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(subject)
      .setIssuer(`${projectUrl}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('1s')
      .sign(privateKey);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(
      (await fetch(url, { headers: { Authorization: `Bearer ${expired}` } }))
        .status,
      401,
    );

    const created = await fetch(url, { headers });
    assert.equal(created.status, 200);
    const profile = (await created.json()) as Record<string, unknown>;
    assert.equal(profile.email, 'alice@example.test');
    assert.equal(profile.displayName, 'alice');
    assert.equal(profile.authSubject, undefined);

    const invalid = await fetch(url, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: '' }),
    });
    assert.equal(invalid.status, 400);

    const updated = await fetch(url, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Alice Developer' }),
    });
    assert.equal(updated.status, 200);
    assert.equal(
      ((await updated.json()) as Record<string, unknown>).displayName,
      'Alice Developer',
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { authSubject: subject } }))
        .displayName,
      'Alice Developer',
    );
  } finally {
    await prisma.user.deleteMany({ where: { authSubject: subject } });
    await prisma.$disconnect();
    await app.close();
    keyServer.close();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
  }
});
