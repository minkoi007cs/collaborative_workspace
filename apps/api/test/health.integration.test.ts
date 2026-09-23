import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

test('health reports PostgreSQL and Redis availability', async () => {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  try {
    const address = app.getHttpServer().address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/health`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      services: { database: 'up', redis: 'up' },
    });
  } finally {
    await app.close();
  }
});
