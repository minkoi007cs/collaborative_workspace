import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config';

test('rejects missing infrastructure configuration', () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL/);
});

test('accepts valid local configuration and defaults the port', () => {
  const config = loadConfig({
    DATABASE_URL: 'postgresql://localhost:55432/syncspace',
    REDIS_URL: 'redis://localhost:56379',
    WEB_ORIGIN: 'http://localhost:3000',
  });
  assert.equal(config.API_PORT, 3001);
});
