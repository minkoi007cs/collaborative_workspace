import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-process-update.mjs',
);

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function verify(cwd, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('staged project changes require a staged process update', () => {
  const cwd = mkdtempSync(resolve(tmpdir(), 'syncspace-process-'));
  try {
    git(cwd, 'init', '-q');
    writeFileSync(resolve(cwd, 'feature.ts'), 'export const value = 1;\n');
    git(cwd, 'add', 'feature.ts');
    const rejected = verify(cwd, '--staged');
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /process.md must be updated/);
    writeFileSync(resolve(cwd, 'process.md'), '# Log\n');
    git(cwd, 'add', 'process.md');
    assert.equal(verify(cwd, '--staged').status, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('history validation rejects an undocumented later commit', () => {
  const cwd = mkdtempSync(resolve(tmpdir(), 'syncspace-history-'));
  try {
    git(cwd, 'init', '-q');
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'config', 'user.email', 'test@example.invalid');
    writeFileSync(resolve(cwd, 'process.md'), '# Log\n');
    git(cwd, 'add', 'process.md');
    git(cwd, 'commit', '-qm', 'initial');
    const base = git(cwd, 'rev-parse', 'HEAD');
    writeFileSync(resolve(cwd, 'feature.ts'), 'export const value = 1;\n');
    git(cwd, 'add', 'feature.ts');
    git(cwd, 'commit', '-qm', 'undocumented');
    assert.equal(verify(cwd, '--range', base, 'HEAD').status, 1);
    assert.equal(verify(cwd, '--all').status, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
