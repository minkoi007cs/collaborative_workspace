import assert from 'node:assert/strict';
import test from 'node:test';
import { evenRanks, rankBetween } from '../src/tasks/rank';

test('task rank tokens sort and find gaps without changing other tasks', () => {
  const ranks = evenRanks(3);
  assert.equal(ranks.length, 3);
  assert.deepEqual([...ranks].sort(), ranks);
  const inserted = rankBetween(ranks[0], ranks[1]);
  assert.ok(inserted && ranks[0] < inserted && inserted < ranks[1]);
  assert.ok(rankBetween(null, ranks[0]));
  assert.ok(rankBetween(ranks[2], null));
  assert.equal(rankBetween('000000000000000001', '000000000000000002'), null);
});
