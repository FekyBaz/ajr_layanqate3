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
  '.github',
  '.genkit',
  '.nvmrc',
  '.eslintrc.json',
  '.gitleaks.toml',
  'api',
  'netlify',
  'prototypes',
  'scripts',
  'tests',
  'tree/README.md',
  'package.json',
  'package-lock.json',
  'netlify.toml',
  'security-rules.json',
  'README.md',
  'CONTRIBUTING.md',
  'DEPLOYMENT.md',
  'ROADMAP.md',
  'SECURITY.md',
  'THIRD_PARTY_NOTICES.md',
];

function listRelativeFiles(directory, prefix = '') {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const relative = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolute = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in deploy output: ${relative}`);
    }

    if (entry.isDirectory()) {
      paths.push(...listRelativeFiles(absolute, relative));
    } else if (entry.isFile()) {
      paths.push(relative);
    } else {
      throw new Error(`Unsupported filesystem entry in deploy output: ${relative}`);
    }
  }

  return paths;
}

function assertOutputPathIsSafe(outputDirectory) {
  const output = path.resolve(outputDirectory);
  const insideProject = path.relative(ROOT, output);
  const isInsideProject = insideProject !== ''
    && insideProject !== '..'
    && !insideProject.startsWith(`..${path.sep}`)
    && !path.isAbsolute(insideProject);
  const isProjectRoot = output === ROOT;
  const isFilesystemRoot = output === path.parse(output).root;
  const isProjectAncestor = ROOT === output || ROOT.startsWith(`${output.replace(/[\\/]+$/, '')}${path.sep}`);

  if (isProjectRoot || isFilesystemRoot || isProjectAncestor || (isInsideProject && insideProject !== 'dist')) {
    throw new Error('The build output must be dist/ or a temporary directory outside the repository.');
  }

  return output;
}

function verifyPublicBuild(outputDirectory = DEFAULT_OUTPUT_DIR) {
  const output = path.resolve(outputDirectory);

  if (!fs.existsSync(output) || !fs.statSync(output).isDirectory()) {
    throw new Error(`Public build directory does not exist: ${output}`);
  }

  const actual = listRelativeFiles(output).sort();
  const expected = [...PUBLIC_FILES].sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));

  if (missing.length || unexpected.length) {
    const details = [
      missing.length ? `Missing public files: ${missing.join(', ')}` : '',
      unexpected.length ? `Unexpected published files: ${unexpected.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    throw new Error(details);
  }

  const leaked = FORBIDDEN_PUBLISH_PATHS.filter((file) => fs.existsSync(path.join(output, file)));
  if (leaked.length) {
    throw new Error(`Internal paths must not be published: ${leaked.join(', ')}`);
  }

  return { output, fileCount: actual.length };
}

function buildPublicAssets(outputDirectory = DEFAULT_OUTPUT_DIR) {
  const output = assertOutputPathIsSafe(outputDirectory);
  fs.rmSync(output, { recursive: true, force: true });

  for (const relativeFile of PUBLIC_FILES) {
    const source = path.resolve(ROOT, relativeFile);
    const target = path.resolve(output, relativeFile);

    if (!source.startsWith(`${ROOT}${path.sep}`)) {
      throw new Error(`Public file escaped the repository root: ${relativeFile}`);
    }

    if (!target.startsWith(`${output}${path.sep}`)) {
      throw new Error(`Public file escaped the output directory: ${relativeFile}`);
    }

    if (!fs.existsSync(source) || !fs.lstatSync(source).isFile() || fs.lstatSync(source).isSymbolicLink()) {
      throw new Error(`Allowlisted public file is missing or not a regular file: ${relativeFile}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }

  const result = verifyPublicBuild(output);
  process.stdout.write(`Built ${result.fileCount} allowlisted public files in ${result.output}\n`);
  return result;
}

if (require.main === module) {
  try {
    if (process.argv.includes('--verify')) {
      const result = verifyPublicBuild();
      process.stdout.write(`Verified ${result.fileCount} allowlisted public files in ${result.output}\n`);
    } else {
      buildPublicAssets();
    }
  } catch (error) {
    process.stderr.write(`Public build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  FORBIDDEN_PUBLISH_PATHS,
  PUBLIC_FILES,
  buildPublicAssets,
  verifyPublicBuild,
};
