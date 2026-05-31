'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const cli = path.join(__dirname, '..', 'cli', 'index.js');

test('doctor --json returns version', () => {
  const out = execFileSync(process.execPath, [cli, 'doctor', '--json'], {
    encoding: 'utf8',
  });
  const row = JSON.parse(out.trim());
  assert.equal(typeof row.version, 'string');
  assert.match(row.version, /^\d+\.\d+\.\d+$/);
});
