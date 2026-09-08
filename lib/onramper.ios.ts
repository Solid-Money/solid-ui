import { OnramperClient } from '@onramper/onramper-react-native';

import { fetchOnramperSession, type OnramperSession } from '@/lib/api';
import {
  EXPO_PUBLIC_ONRAMPER_API_KEY,
  EXPO_PUBLIC_ONRAMPER_CLIENT_ID,
  isProduction,
} from '@/lib/config';
import { describeOnramperError } from '@/lib/onramperErrors';
import { withRefreshToken } from '@/lib/utils';

// Real implementation, loaded by Metro only on iOS. Android and web get
// lib/onramper.ts, which declares the SDK unavailable. See that file for why.

export const isOnramperSupported: boolean = true;

// One client per app session. OnramperClient creates its own native Nitro hybrid
// object in its constructor and releases it in destroy(), so constructing one per
// screen or per render would leak native SDK clients.
let client: OnramperClient | null = null;

// Single-flight guard: concurrent callers (e.g. two screens mounting at once)
// share one bootstrap instead of racing two initialize() calls.
let initialization: Promise<OnramperClient> | null = null;

/**
 * Mints a session via our backend. Used for the initial bootstrap and reused as the
 * SDK's `onSessionExpired` handler — the SDK refreshes proactively and on 401, so
 * this normally only fires when the refresh token itself was revoked or rotated.
 */
const mintSession = (): Promise<OnramperSession> => withRefreshToken(() => fetchOnramperSession());

/**
 * The initialized client, or `null` if `initOnramper()` hasn't completed yet.
 * Prefer `useOnramperClient()` in components; this is for non-React callers.
 */
export function getOnramperClient(): OnramperClient {
  if (!client) {
    throw new Error('Onramper has not been initialized yet — call initOnramper() first.');
  }
  return client;
}

/**
 * Constructs and bootstraps the client. Idempotent: repeat calls return the same
 * instance, and a failed attempt is discarded so a later call can retry.
 */
export function initOnramper(): Promise<OnramperClient> {
  if (initialization) return initialization;

  initialization = (async () => {
    if (!EXPO_PUBLIC_ONRAMPER_API_KEY || !EXPO_PUBLIC_ONRAMPER_CLIENT_ID) {
      throw new Error('Missing EXPO_PUBLIC_ONRAMPER_API_KEY or EXPO_PUBLIC_ONRAMPER_CLIENT_ID.');
    }

    // Mint the session before constructing, so a backend failure doesn't leave an
    // orphaned native client behind.
    let session: OnramperSession;
    try {
      session = await mintSession();
    } catch (error) {
      // Named separately from the native failures below: the screen shows one
      // message for the whole bootstrap, so the log is the only thing that says
      // which half of it broke.
      console.error(`[Onramper] session mint failed: ${describeOnramperError(error)}`);
      throw error;
    }

    // The constructor creates the native Nitro object and can throw on its own
    // (a missing key, an unsupported device), so it is inside the memoized body
    // and its failure is reported like any other.
    const instance = new OnramperClient({
      apiKey: EXPO_PUBLIC_ONRAMPER_API_KEY,
      clientId: EXPO_PUBLIC_ONRAMPER_CLIENT_ID,
      environment: 'production',
      theme: 'system',
      logLevel: isProduction ? 'off' : 'error',
      onSessionExpired: mintSession,
    });

    try {
      await instance.initialize(session);
    } catch (error) {
      // configure() or initialize() failed — release the native object rather than
      // stranding it, then let the caller surface the error.
      //
      // Logged with its code, because that is the diagnosis: `attestationFailed`
      // is a provisioning problem, `deviceBlocked` and `configurationError` are
      // account-side, `networkError` is neither. The message alone
      // ("Failed to initialize") separates none of them.
      console.error(`[Onramper] initialize failed: ${describeOnramperError(error)}`);
      instance.destroy();
      throw error;
    }

    client = instance;
    return instance;
  })();

  // Drop the memo on failure so the next caller retries instead of replaying the
  // rejection forever (e.g. the user lost connectivity on first attempt).
  initialization.catch(() => {
    initialization = null;
  });

  return initialization;
}

/**
 * Releases the native client and resets module state.
 *
 * Note what this does *not* do: `destroy()` frees the native object but leaves
 * the stored OnramperID (OIDC) tokens on the device, so the login itself
 * survives. Logout wants `signOutOnramper()` for that reason.
 */
export function destroyOnramper(): void {
  client?.destroy();
  client = null;
  initialization = null;
}

/**
 * Clears the stored OnramperID login, then releases the client. Call on logout.
 *
 * `destroyOnramper()` alone is not enough: the OIDC tokens live on the device
 * rather than on the client instance, so releasing the instance leaves the
 * previous user signed in to Onramper. The next account on the same device
 * would then reach a checkout that needs `user_info` and never be asked to log
 * in — it would transact as whoever used the app last.
 *
 * Works even when `initOnramper()` failed: `signOut()` only awaits the
 * constructor's `configure()`, not `initialize()`. When nothing is live a
 * throwaway client is configured purely to reach the stored tokens, because
 * "init failed" is exactly the state where a stale login is the likely cause.
 *
 * Never rejects. Logout must not be blocked by an onramp, and a device with no
 * stored login is the common case rather than an error.
 */
export async function signOutOnramper(): Promise<void> {
  // Detach module state first, so a caller mid-logout cannot pick up an
  // instance that is about to be torn down.
  const live = client;
  client = null;
  initialization = null;

  let instance = live;

  if (!instance) {
    if (!EXPO_PUBLIC_ONRAMPER_API_KEY || !EXPO_PUBLIC_ONRAMPER_CLIENT_ID) return;

    try {
      instance = new OnramperClient({
        apiKey: EXPO_PUBLIC_ONRAMPER_API_KEY,
        clientId: EXPO_PUBLIC_ONRAMPER_CLIENT_ID,
        environment: isProduction ? 'production' : 'development',
        theme: 'system',
        logLevel: isProduction ? 'off' : 'error',
        // Never called: signing out needs no partner session, and handing it a
        // mint would have it fetch one on the way out.
        onSessionExpired: mintSession,
      });
    } catch (error) {
      console.error(
        `[Onramper] signOut could not configure a client: ${describeOnramperError(error)}`,
      );
      return;
    }
  }

  try {
    await instance.signOut();
  } catch (error) {
    console.error(`[Onramper] signOut failed: ${describeOnramperError(error)}`);
  } finally {
    // Released either way: a throwaway existed only for this call, and a live
    // one is being torn down as part of the same logout.
    instance.destroy();
  }
}
