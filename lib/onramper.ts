import { Platform } from 'react-native';
import { OnramperClient } from '@onramper/onramper-react-native';

import { fetchOnramperSession } from './api';
import { EXPO_PUBLIC_ONRAMPER_API_KEY, EXPO_PUBLIC_ONRAMPER_CLIENT_ID } from './config';

// Platform-specific resolution target for TypeScript, and the runtime fallback for
// every platform except iOS. Metro loads lib/onramper.ios.ts on iOS and this file
// on Android and web.
//
// @onramper/onramper-react-native wraps Onramper's *iOS* SDK: it ships no android/
// implementation, and metro.config.js stubs it out of the web bundle entirely
// (importing it there would pull in react-native internals that don't exist under
// react-native-web). Constructing OnramperClient off-iOS throws from the SDK
// itself, so this file keeps that failure declarative instead of a native crash.
//
// The `import type` above is erased at compile time, so this file never requires
// the package at runtime.

// Typed as `boolean` rather than the literal `false` on purpose: consumers see only
// this file's types, and a literal would let TypeScript narrow the iOS code path
// away as unreachable.
export const isOnramperSupported: boolean = false;

const unsupported = () => new Error(`Onramper is only supported on iOS, not ${Platform.OS}.`);

export function getOnramperClient(): OnramperClient {
  throw unsupported();
}

export async function initOnramper(): Promise<OnramperClient> {
  const client = new OnramperClient({
    apiKey: EXPO_PUBLIC_ONRAMPER_API_KEY,
    clientId: EXPO_PUBLIC_ONRAMPER_CLIENT_ID,
    environment: 'development',
    theme: 'system',
    logLevel: 'off',

    onSessionExpired: () => {
      return fetchOnramperSession();
    },
  });

  const { sessionId, sessionToken } = await fetchOnramperSession();
  console.log('Onramper session:', { sessionId, sessionToken });

  await client.initialize({ sessionId, sessionToken });

  return client;
}

export function destroyOnramper(): void {
  // Nothing is ever constructed off-iOS, so there is nothing to tear down.
}
