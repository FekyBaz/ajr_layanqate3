'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'dist');

// This is the deployment allowlist. Add a path only when it is intended to be
// downloadable by public site visitors. Repository docs, database migrations,
// tests, serverless function source, prototypes, and tooling are intentionally
// not included in the static publish directory.
const PUBLIC_FILES = [
  'PRIVACY.md',
  'adhkar.css',
  'adhkar.html',
  'adhkar.js',
  'admin.css',
  'admin.html',
  'admin.js',
  'analytics.html',
  'base.css',
  'community-posters.js',
  'community.css',
  'community.html',
  'community.js',
  'contact.css',
  'contact.html',
  'contact.js',
  'create-memory.html',
  'create-memory.js',
  'fatiha-counter-init.js',
  'home-community-preview.js',
  'home-memories-preview.js',
  'home.css',
  'index.html',
  'manifest.webmanifest',
  'martyrs.css',
  'martyrs.html',
  'memories.html',
  'memories.js',
  'memory.css',
  'memory.html',
  'memory.js',
  'offline.css',
  'offline.html',
  'og-image.png',
  'poster.css',
  'poster.html',
  'robots.txt',
  'script.js',
  'share-project.js',
  'sitemap.xml',
  'styles.css',
  'sw.js',
  'components/ChartsSection.js',
  'components/LoadMoreButton.js',
  'components/MartyrsList.js',
  'components/StatsSection.js',
  'data/martyrs.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'lib/analytics-dashboard.js',
  'lib/analytics.js',
  'lib/calculateStats.js',
  'lib/config.js',
  'lib/consent.css',
  'lib/consent.js',
  'lib/escape.js',
  'lib/fetch-utils.js',
  'lib/fetchMartyrs.js',
  'lib/ga4.js',
  'lib/mobile-nav.js',
  'lib/modal.js',
  'lib/normalizeData.js',
  'lib/share.js',
  'lib/sw-register.js',
  'pages/martyrs.js',
  'poster/BackgroundSystem.js',
  'poster/ExportEngine.js',
  'poster/FontLoader.js',
  'poster/MotionPreview.js',
  'poster/PosterEngine.js',
  'poster/ShareSystem.js',
  'poster/TemplateSystem.js',
  'poster/ThemeManager.js',
  'poster/TypographySystem.js',
  'poster/dawn-masjid-bg.png',
  'poster/favicon-community.png',
  'poster/favicon-home.png',
  'poster/favicon-memories.png',
  'poster/favicon-poster.png',
  'poster/minimal-noor-bg.png',
  'poster/nature-serenity-bg.png',
  'poster/night-serenity-bg.png',
  'poster/paradise-spring-bg.png',
  'poster/premium-gold-bg.png',
  'poster/seed-1.png',
  'poster/seed-2.png',
  'poster/seed-3.png',
  'tree/GlowEffects.js',
  'tree/LeafSystem.js',
  'tree/RealtimeEngine.js',
  'tree/TreeAnimations.js',
  'tree/TreePhysics.js',
  'tree/TreeState.js',
  'tree/TreeView.js',
];

const FORBIDDEN_PUBLISH_PATHS = [
  '.github', '.genkit', '.nvmrc', '.eslintrc.json', 'eslint.config.js',
  '.gitleaks.toml', 'api', 'netlify', 'prototypes', 'scripts', 'tests',
  'tree/README.md', 'package.json', 'package-lock.json', 'netlify.toml',
  'security-rules.json', 'README.md', 'CONTRIBUTING.md', 'DEPLOYMENT.md',
  'ROADMAP.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md',
];

function listRelativeFiles(directory, prefix = '') {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const relative = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolute = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in deploy output: ${relative}`);
    } else if (entry.isDirectory()) {
      paths.push(...listRelativeFiles(absolute, relative));
    } else if (entry.isFile()) {
      paths.push(relative);
    } else {
      throw new Error(`Unsupported filesystem entry in deploy output: ${relative}`);
    }
  }
  return paths.sort();
}

function isWithin(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function validateOutputDirectory(outputDir) {
  const resolved = path.resolve(outputDir);
  const root = path.parse(resolved).root;

  if (resolved === root) {
    throw new Error('Build output must not be a filesystem root.');
  }
  if (resolved === ROOT || isWithin(resolved, ROOT)) {
    throw new Error('Build output must be outside the project root or a dedicated dist directory.');
  }
  if (resolved !== DEFAULT_OUTPUT_DIR && isWithin(ROOT, resolved)) {
    throw new Error('Build output must be dist/ or a dedicated temporary directory.');
  }
  if (resolved !== DEFAULT_OUTPUT_DIR) {
    const basename = path.basename(resolved).toLowerCase();
    if (!basename.startsWith('dist') && !basename.startsWith('ajr-public-build-')) {
      throw new Error('Build output must be dist/ or a dedicated temporary directory.');
    }
  }
  return resolved;
}

function verifyPublicBuild(outputDir = DEFAULT_OUTPUT_DIR) {
  const target = validateOutputDirectory(outputDir);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error('Build output directory does not exist.');
  }

  const actual = listRelativeFiles(target);
  const expected = [...PUBLIC_FILES].sort();
  const sortedActual = [...actual].sort();
  const missing = expected.filter((relative) => !sortedActual.includes(relative));
  const unexpected = sortedActual.filter((relative) => !expected.includes(relative));

  if (missing.length || unexpected.length) {
    throw new Error([
      missing.length ? `Missing public assets: ${missing.join(', ')}` : '',
      unexpected.length ? `Unexpected public assets: ${unexpected.join(', ')}` : '',
    ].filter(Boolean).join('\n'));
  }

  const leaked = FORBIDDEN_PUBLISH_PATHS.filter((relative) => fs.existsSync(path.join(target, relative)));
  if (leaked.length) {
    throw new Error(`Internal paths must not be published: ${leaked.join(', ')}`);
  }

  return { outputDir: target, fileCount: actual.length };
}

function buildPublicAssets(outputDir = DEFAULT_OUTPUT_DIR) {
  const target = validateOutputDirectory(outputDir);
  const missing = PUBLIC_FILES.filter((relative) => !fs.existsSync(path.join(ROOT, relative)));
  if (missing.length > 0) {
    throw new Error(`Public assets are missing: ${missing.join(', ')}`);
  }

  // A caller may only clean the default project dist directory or a narrowly
  // named dedicated temporary output directory; arbitrary paths are rejected.
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const relative of PUBLIC_FILES) {
    const source = path.join(ROOT, relative);
    const destination = path.join(target, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  const result = verifyPublicBuild(target);
  console.log(`Built ${result.fileCount} allowlisted public files in ${result.outputDir}`);
  return result;
}

function verifyPublicBuild(outputDir = DEFAULT_OUTPUT_DIR) {
  const target = validateOutputDirectory(outputDir);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error('Build output directory does not exist.');
  }

  const actual = listRelativeFiles(target);
  const expected = [...PUBLIC_FILES].sort();
  const missing = expected.filter((relative) => !actual.includes(relative));
  const unexpected = actual.filter((relative) => !expected.includes(relative));

  if (missing.length || unexpected.length) {
    throw new Error([
      missing.length ? `Missing public assets: ${missing.join(', ')}` : '',
      unexpected.length ? `Unexpected public assets: ${unexpected.join(', ')}` : '',
    ].filter(Boolean).join('\n'));
  }
  return { outputDir: target, fileCount: actual.length };
}

if (require.main === module) {
  try {
    if (process.argv.includes('--verify')) {
      const result = verifyPublicBuild();
      console.log(`Verified ${result.fileCount} allowlisted public files in ${result.outputDir}`);
    } else {
      const result = buildPublicAssets();
      console.log(`Built ${result.fileCount} allowlisted public files in ${result.outputDir}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  PUBLIC_FILES,
  FORBIDDEN_PUBLISH_PATHS,
  buildPublicAssets,
  verifyPublicBuild,
};
