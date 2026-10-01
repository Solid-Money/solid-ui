/**
 * `expo export` for web, with the release identifier baked into the bundle.
 *
 * Metro only inlines `EXPO_PUBLIC_*` variables, and Vercel's own
 * VERCEL_GIT_COMMIT_SHA is not one of them, so the value has to be resolved
 * here and put on the child process's environment before the export runs.
 */
import { spawnSync } from 'node:child_process';

import { resolveRelease } from './release.mjs';

const release = resolveRelease();
console.log(`[export:web] release ${release}`);

const result = spawnSync('npx', ['expo', 'export', '-p', 'web', '--source-maps'], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_SENTRY_RELEASE: release },
});

process.exit(result.status ?? 1);
