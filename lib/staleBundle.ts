import { Platform } from 'react-native';

/**
 * Recovery for a web tab left running against a superseded deploy.
 *
 * A code-split chunk is fetched by content-hashed filename at the moment it is
 * first rendered. Deploying rewrites those filenames, so a tab opened before the
 * deploy asks for a file the host no longer serves. Every request 404s, which is
 * why `lazyWithRetry` cannot help here — it covers the transient case, where the
 * file exists and the network blipped. Nothing the running bundle can do will
 * make the missing chunk appear; only a fresh document, which names the current
 * chunks, recovers the tab.
 *
 * In the August data this reached the error boundary as `AsyncRequireError`
 * across seven different chunk hashes, which is the fingerprint of long-lived
 * tabs rather than a bad build.
 */

/**
 * Substrings that identify a chunk that could not be loaded. Metro raises
 * `AsyncRequireError` with a "Loading module <url> failed" message; the others
 * are the equivalents thrown by browsers and bundlers for a failed dynamic
 * import, kept so the check still holds if the bundler or host changes.
 */
const STALE_BUNDLE_PATTERNS = [
  'asyncrequireerror',
  'loading module',
  'loading chunk',
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
];

/**
 * Whether this error is a chunk the browser could not load, rather than a fault
 * in the app's own code. Native is excluded: its bundle ships with the binary or
 * the OTA update, so there is no chunk to go missing and a reload would not fix
 * anything it could.
 */
export const isStaleBundleError = (error: unknown): boolean => {
  if (Platform.OS !== 'web' || !error) return false;

  const { name, message } = error as { name?: unknown; message?: unknown };
  const haystack = [
    typeof name === 'string' ? name : '',
    typeof message === 'string' ? message : '',
  ]
    .join(' ')
    .toLowerCase();

  return STALE_BUNDLE_PATTERNS.some(pattern => haystack.includes(pattern));
};

/**
 * Reload onto the current deploy.
 *
 * Cache Storage is cleared first so a cached copy of the old document — which
 * names the old chunks — cannot be what the reload lands on. If the host serves
 * the HTML itself with a long max-age, that is a CDN setting no client-side code
 * can work around, and it is the thing to fix rather than to paper over here.
 */
export const reloadForNewBundle = async (): Promise<void> => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch {
    // Storage access throws outright in some private-browsing modes. The reload
    // below is the part that matters, so never let this stop it.
  }

  window.location.reload();
};
