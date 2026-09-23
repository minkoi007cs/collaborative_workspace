const MAX_RANK = BigInt('999999999999999999');

function parse(rank: string) {
  if (!/^\d{18}$/.test(rank)) throw new Error('Invalid task rank');
  return BigInt(rank);
}

function encode(value: bigint) {
  return value.toString().padStart(18, '0');
}

export function rankBetween(left: string | null, right: string | null) {
  const lower = left === null ? 0n : parse(left);
  const upper = right === null ? MAX_RANK : parse(right);
  if (upper - lower <= 1n) return null;
  return encode((lower + upper) / 2n);
}

export function evenRanks(count: number) {
  if (!Number.isSafeInteger(count) || count < 0 || count > 100000)
    throw new Error('Invalid task count');
  const step = MAX_RANK / BigInt(count + 1);
  return Array.from({ length: count }, (_, index) =>
    encode(step * BigInt(index + 1)),
  );
}
