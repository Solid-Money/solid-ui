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
      environment: isProduction ? 'production' : 'development',
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
 * Releases the native client and resets module state. Call on logout — the session
 * is scoped to the signed-in user, so it must not survive into the next account.
 */
export function destroyOnramper(): void {
  client?.destroy();
  client = null;
  initialization = null;
}
