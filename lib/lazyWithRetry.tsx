import React from 'react';

type Loader<T extends React.ComponentType<any>> = () => Promise<{ default: T }>;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * `React.lazy` that retries the dynamic import before giving up.
 *
 * A code-split chunk is fetched over the network at the moment it is first
 * rendered, so any blip — a dropped connection, a slow mobile handoff, a
 * transient CDN error — rejects the import. React surfaces that rejection as a
 * render error, which means one failed request takes out the whole subtree under
 * the Suspense boundary; `LazyThirdwebProvider` wraps nearly the entire app, so
 * there it took out the app. `AsyncRequireError` was the third-largest
 * error-boundary crash in the August data at ~17 events, all on web.
 *
 * Retrying is not a cure-all: when a deploy has replaced the content-hashed
 * chunk this bundle asks for, every attempt 404s and the boundary still shows.
 * Only a fresh document fixes that, which is a product call rather than a
 * default we should take on a user's behalf.
 *
 * Extracted from the copy in `LazyAreaChart`, which already did this, so every
 * lazy boundary gets the same behavior instead of one of them.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  load: Loader<T>,
): React.LazyExoticComponent<T> {
  return React.lazy(() => {
    const attempt = (retries: number): Promise<{ default: T }> =>
      load().catch((error: unknown) => {
        if (retries <= 0) throw error;
        return new Promise<{ default: T }>(resolve =>
          setTimeout(() => resolve(attempt(retries - 1)), RETRY_DELAY_MS),
        );
      });
    return attempt(MAX_RETRIES);
  });
}

export default lazyWithRetry;
