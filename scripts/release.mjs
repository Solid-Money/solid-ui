/**
 * Resolves the release identifier shared by the web bundle and its source maps.
 *
 * The SDK tags events with this string and the upload stamps artifacts with the
 * same one; if the two ever disagree, GlitchTip has the maps but cannot match
 * them to the event and stack traces stay minified. Both sides call this.
 *
 * Format is `solid-ui@<git-commit-sha>`, as agreed with the GlitchTip owner.
 */
import { execFileSync } from 'node:child_process';

const PREFIX = 'solid-ui';

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function resolveRelease() {
  // An explicit value wins, so a deploy can be re-pointed without a code change.
  if (process.env.EXPO_PUBLIC_SENTRY_RELEASE) {
    return process.env.EXPO_PUBLIC_SENTRY_RELEASE;
  }

  // Vercel and GitHub Actions both hand us the SHA; a local build falls back to
  // git. Vercel shallow-clones but still keeps HEAD, so `git rev-parse` works.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || gitSha() || 'unknown';

  return `${PREFIX}@${sha}`;
}
