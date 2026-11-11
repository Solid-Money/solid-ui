/**
 * Proof that a public auth request (recovery, signup, account lookups, email
 * change) comes from this app on a real device: a Firebase App Check token —
 * App Attest (DeviceCheck fallback) on iOS, Play Integrity on Android — sent as
 * `X-Firebase-AppCheck`. The backend checks it before mailing a code or
 * answering a lookup (BotProtectionGuard in accounts-service), which a script
 * calling the API from rotating IPs can't satisfy.
 *
 * The web build uses Cloudflare Turnstile instead (botProtection.web.ts); Metro
 * picks the right file per platform.
 *
 * Never throws and never holds a request up for long: when App Check can't
 * produce a token — a binary built before this module was added (it can still
 * receive this bundle over the air), a simulator whose debug token isn't
 * registered, a slow first attestation — the request goes without one and the
 * backend decides (monitor mode logs it, enforce refuses it).
 *
 * Development builds use the debug provider. On first launch it logs a debug
 * token to the device console; register that in the Firebase console (App
 * Check → Manage debug tokens). The token is a credential, so it is never
 * read from an EXPO_PUBLIC_ variable, which would ship it in the bundle.
 */
export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';

/** The first App Attest / Play Integrity round trip can take a few seconds. */
const TOKEN_TIMEOUT_MS = 5000;

type AppCheckModule = typeof import('@react-native-firebase/app-check');
type AppCheckInstance = Awaited<ReturnType<AppCheckModule['initializeAppCheck']>>;

let appCheckReady: Promise<{ module: AppCheckModule; instance: AppCheckInstance } | null> | null =
  null;

function initializeAppCheck() {
  appCheckReady ??= (async () => {
    try {
      // Loaded on first use, as lib/observe.ts loads expo-observe: a binary
      // built before this module was added (runtimeVersion is appVersion, so it
      // can receive this bundle over the air) fails here, not at app start.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module: AppCheckModule = require('@react-native-firebase/app-check');
      const instance = await module.initializeAppCheck(undefined, {
        provider: {
          providerOptions: {
            android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
            apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
          },
        },
        // Tokens are fetched only when a protected request needs one. Background
        // refresh would spend a Play Integrity call per active user per hour,
        // against a daily quota, for requests most sessions never make.
        isTokenAutoRefreshEnabled: false,
      });
      return { module, instance };
    } catch (error) {
      console.warn('[botProtection] App Check is unavailable on this build:', error);
      return null;
    }
  })();
  return appCheckReady;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** Headers proving this request comes from the app; `{}` when App Check can't say. */
export async function getBotProtectionHeaders(): Promise<Record<string, string>> {
  try {
    const appCheck = await withTimeout(initializeAppCheck(), TOKEN_TIMEOUT_MS);
    if (!appCheck) return {};
    // Cached until it nears expiry, so repeat calls cost nothing.
    const result = await withTimeout(
      appCheck.module.getToken(appCheck.instance, false),
      TOKEN_TIMEOUT_MS,
    );
    return result?.token ? { [APP_CHECK_HEADER]: result.token } : {};
  } catch (error) {
    console.warn('[botProtection] Could not get an App Check token:', error);
    return {};
  }
}

/** Test seam: forget the initialized App Check instance. */
export function resetBotProtectionForTests() {
  appCheckReady = null;
}
