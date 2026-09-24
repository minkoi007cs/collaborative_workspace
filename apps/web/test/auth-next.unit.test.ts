import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { safeNextPath } from '../src/lib/auth-next';
import { middleware } from '../src/middleware';

test('only invite paths with token-shaped segments may follow sign in', () => {
  const token = 'a'.repeat(43);
  assert.equal(safeNextPath(`/invite/${token}`), `/invite/${token}`);
  assert.equal(safeNextPath('//evil.example'), '/app');
  assert.equal(safeNextPath('/invite/../../admin'), '/app');
  assert.equal(safeNextPath('/invite/bad'), '/app');
});

test('a normal sign-in visit clears an old invitation destination', async () => {
  const token = 'a'.repeat(43);
  const invited = await middleware(
    new NextRequest(`http://localhost:3000/login?next=/invite/${token}`),
  );
  assert.equal(
    invited.cookies.get('syncspace_auth_next')?.value,
    `/invite/${token}`,
  );
  const normal = await middleware(
    new NextRequest('http://localhost:3000/login', {
      headers: { cookie: `syncspace_auth_next=/invite/${token}` },
    }),
  );
  assert.equal(normal.cookies.get('syncspace_auth_next')?.value, '');
  assert.equal(normal.headers.get('cache-control'), 'private, no-store');
});
