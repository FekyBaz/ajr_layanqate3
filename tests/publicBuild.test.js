import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import build from '../scripts/build-public.cjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('public build contains only the explicit deploy allowlist', () => {
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), 'ajr-public-build-'));
  const outputDirectory = path.join(temporaryParent, 'dist');

  try {
    const result = build.buildPublicAssets(outputDirectory);
    const verified = build.verifyPublicBuild(outputDirectory);

    assert.equal(result.fileCount, build.PUBLIC_FILES.length);
    assert.equal(verified.fileCount, build.PUBLIC_FILES.length);

    for (const forbiddenPath of build.FORBIDDEN_PUBLISH_PATHS) {
      assert.equal(
        fs.existsSync(path.join(outputDirectory, forbiddenPath)),
        false,
        `Internal path was included in public output: ${forbiddenPath}`,
      );
    }

    for (const expectedFile of [
      'index.html',
      'community.html',
      'manifest.webmanifest',
      'lib/config.js',
      'components/StatsSection.js',
      'poster/PosterEngine.js',
      'tree/TreeView.js',
      'PRIVACY.md',
    ]) {
      assert.equal(
        fs.existsSync(path.join(outputDirectory, expectedFile)),
        true,
        `Expected public asset is missing: ${expectedFile}`,
      );
    }

    assert.throws(
      () => build.buildPublicAssets(projectRoot),
      /build output must be dist/,
    );
  } finally {
    fs.rmSync(temporaryParent, { recursive: true, force: true });
  }
});
