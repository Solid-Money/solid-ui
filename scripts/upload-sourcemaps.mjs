/**
 * Uploads the web bundle's source maps to GlitchTip.
 *
 * GlitchTip speaks the Sentry release/artifact API, so this is plain
 * `sentry-cli` pointed at SENTRY_URL. It runs after `expo export -p web
 * --source-maps` and before `sourcemaps:strip` deletes the maps from `dist`,
 * so the maps reach GlitchTip but never reach the CDN.
 *
 * `sourcemaps inject` writes debug IDs into the bundle and its map, which is
 * how GlitchTip >= 4.2 matches a stack frame to its source. The release is
 * created and finalized as well, so symbolication still works on an instance
 * that falls back to the legacy release-files path.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { resolveRelease } from './release.mjs';

const REQUIRED = ['SENTRY_URL', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'];

const missing = REQUIRED.filter(name => !process.env[name]);
if (missing.length > 0) {
  // Preview/fork deployments are not given the auth token. Skipping keeps them
  // building; the only cost is that their stack traces stay minified.
  console.warn(
    `[sourcemaps:upload] skipped — missing ${missing.join(', ')}. ` +
      'Stack traces for this build will not be symbolicated.',
  );
  process.exit(0);
}

// Expo writes the web bundle here; fall back to the whole export if the layout
// ever changes, since sentry-cli only picks up .js/.map either way.
const WEB_BUNDLE_DIR = 'dist/_expo/static/js/web';
const target = existsSync(WEB_BUNDLE_DIR) ? WEB_BUNDLE_DIR : 'dist';

if (!existsSync(target)) {
  console.error(`[sourcemaps:upload] ${target} does not exist — run export:web first.`);
  process.exit(1);
}

const release = resolveRelease();
console.log(`[sourcemaps:upload] release ${release} from ${target}`);

function sentryCli(args, { allowFailure = false } = {}) {
  const result = spawnSync('npx', ['--no-install', 'sentry-cli', ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0 && !allowFailure) {
    console.error(`[sourcemaps:upload] sentry-cli ${args[0]} failed`);
    process.exit(result.status ?? 1);
  }

  return result.status === 0;
}

sentryCli(['sourcemaps', 'inject', target]);
// Already-created releases are not an error on a rebuild of the same commit.
sentryCli(['releases', 'new', release], { allowFailure: true });
sentryCli(['sourcemaps', 'upload', '--release', release, target]);
sentryCli(['releases', 'finalize', release], { allowFailure: true });

console.log('[sourcemaps:upload] done');
