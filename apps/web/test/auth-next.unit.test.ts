import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNextPath } from '../src/lib/auth-next';

test('only invite paths with token-shaped segments may follow sign in', () => {
  const token = 'a'.repeat(43);
  assert.equal(safeNextPath(`/invite/${token}`), `/invite/${token}`);
  assert.equal(safeNextPath('//evil.example'), '/app');
  assert.equal(safeNextPath('/invite/../../admin'), '/app');
  assert.equal(safeNextPath('/invite/bad'), '/app');
});
