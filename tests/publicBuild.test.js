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
      /The build output must be the repository dist\\/ directory or a dedicated temporary output directory\./,
    );
    assert.throws(
      () => build.buildPublicAssets(path.parse(projectRoot).root),
      /build output must be dist/,
    );
  } finally {
    fs.rmSync(temporaryParent, { recursive: true, force: true });
  }
});

test('public build rejects arbitrary temp paths before destructive cleanup', () => {
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), 'ajr-public-build-'));
  const outputDirectory = path.join(temporaryParent, 'dist');
  const sentinelPath = path.join(temporaryParent, 'sentinel.txt');
  fs.writeFileSync(sentinelPath, 'keep me');

  try {
    for (const rejectedPath of [
      path.parse(projectRoot).root,
      projectRoot,
      path.dirname(projectRoot),
      temporaryParent,
      path.join(path.dirname(temporaryParent), 'dist'),
      path.join(temporaryParent, 'unrelated'),
    ]) {
      assert.throws(() => build.buildPublicAssets(rejectedPath));
    }

    assert.equal(fs.readFileSync(sentinelPath, 'utf8'), 'keep me');
    assert.equal(fs.existsSync(temporaryParent), true);

    const built = build.buildPublicAssets(outputDirectory);
    assert.equal(built.fileCount, build.PUBLIC_FILES.length);
    assert.equal(build.verifyPublicBuild(outputDirectory).fileCount, build.PUBLIC_FILES.length);
  } finally {
    fs.rmSync(temporaryParent, { recursive: true, force: true });
  }
});

test('public output verifier rejects symbolic links and non-regular entries', () => {
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), 'ajr-public-build-'));
  const outputDirectory = path.join(temporaryParent, 'dist');
  const externalDirectory = path.join(temporaryParent, 'external');
  fs.mkdirSync(externalDirectory);
  fs.writeFileSync(path.join(externalDirectory, 'private.txt'), 'do not publish');

  try {
    build.buildPublicAssets(outputDirectory);
    fs.symlinkSync(externalDirectory, path.join(outputDirectory, 'unexpected-link'), 'dir');
    assert.throws(() => build.verifyPublicBuild(outputDirectory), /symbolic links/i);
  } finally {
    fs.rmSync(temporaryParent, { recursive: true, force: true });
  }
});
