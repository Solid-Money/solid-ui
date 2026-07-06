import * as Linking from 'expo-linking';

// Hosts that serve Universal Links (iOS) / App Links (Android) for the app.
// Incoming links on these hosts are rewritten to the matching in-app route.
const KNOWN_HOSTS = ['app.solid.xyz', 'solid.xyz'];

/**
 * Expo Router native deep-link hook.
 *
 * Universal/App Links arrive as full `https://` URLs (e.g. the rewards email
 * CTA `https://app.solid.xyz/rewards?ref=...`). Strip the known host so the
 * router can resolve the file-based route (`/rewards`), preserving query params
 * (referral/UTM) for downstream handling. Custom-scheme links (`solid://...`)
 * and already-relative paths are passed through untouched.
 *
 * Note: attribution capture reads the original URL via `Linking.getInitialURL`
 * independently, so rewriting here does not affect referral/UTM tracking.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (!path.startsWith('http')) return path;

    const { hostname, path: urlPath, queryParams } = Linking.parse(path);
    if (!hostname || !KNOWN_HOSTS.includes(hostname)) return path;

    const pathname = urlPath ? `/${urlPath.replace(/^\/+/, '')}` : '/';
    const query = queryParams
      ? Object.entries(queryParams)
          .filter(([, value]) => value != null)
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
          )
          .join('&')
      : '';

    return query ? `${pathname}?${query}` : pathname;
  } catch {
    return path;
  }
}
