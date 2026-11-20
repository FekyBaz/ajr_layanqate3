import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const submitSource = fs.readFileSync(
  path.join(projectRoot, 'netlify/functions/submit.js'),
  'utf8',
);

test('submission RPC log does not expose raw IP or IP hash', () => {
  const logCall = submitSource.match(
    /logger\.info\('\[submit\] Calling submit_post RPC\.\.\.',\s*\{([\s\S]*?)\}\);/,
  );

  assert.ok(logCall, 'Expected the submission RPC diagnostic log to exist');
  assert.doesNotMatch(
    logCall[1],
    /\b(?:clientIP|ipHash)\b/,
    'Personal IP data must not be included in submission log metadata',
  );
  assert.match(logCall[1], /rateLimitMax/);
  assert.match(logCall[1], /rateLimitHours/);
});
