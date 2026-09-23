import { execFileSync } from 'node:child_process';

const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const isExempt = (file) => file === 'process.md';
const fail = (commit) => {
  console.error(
    `ERROR: process.md must be updated before committing${commit ? ` (${commit})` : ''}.\n\nEvery SyncSpace commit must document what changed, why, tests performed, current project state, and the next recommended step.\nUpdate process.md and stage it before committing.`,
  );
  process.exitCode = 1;
};

if (process.argv.includes('--staged')) {
  const files = run(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    .split('\n')
    .filter(Boolean);
  if (files.some((file) => !isExempt(file)) && !files.includes('process.md'))
    fail();
} else if (process.argv.includes('--range') || process.argv.includes('--all')) {
  const index = process.argv.indexOf('--range');
  const base = process.argv[index + 1];
  const head = process.argv[index + 2];
  if (index !== -1 && (!base || !head))
    throw new Error('Usage: --range <base> <head>');
  const commits = run(
    index === -1
      ? ['rev-list', '--reverse', '--no-merges', 'HEAD']
      : ['rev-list', '--reverse', '--no-merges', `${base}..${head}`],
  )
    .split('\n')
    .filter(Boolean);
  for (const commit of commits) {
    const files = run([
      'diff-tree',
      '--root',
      '--no-commit-id',
      '--name-only',
      '-r',
      commit,
    ])
      .split('\n')
      .filter(Boolean);
    if (files.some((file) => !isExempt(file)) && !files.includes('process.md'))
      fail(commit);
  }
} else {
  throw new Error('Usage: --staged | --range <base> <head> | --all');
}
