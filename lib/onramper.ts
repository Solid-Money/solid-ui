import { Platform } from 'react-native';

import type { OnramperClient } from '@onramper/onramper-react-native';

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

/**
 * Rejects rather than constructing anything.
 *
 * `useOnramperClient` deliberately doesn't gate on platform — it lets the
 * bootstrap fail and surfaces the error — so this is the error it surfaces, and
 * it has to say why. Constructing a client here instead would defeat that: on
 * web the module is stubbed to empty, so `new OnramperClient()` raises
 * "OnramperClient is not a constructor", and on Android it reaches a Nitro
 * module with no native implementation behind it. Both are the same fact told
 * badly.
 */
export function initOnramper(): Promise<OnramperClient> {
  return Promise.reject(unsupported());
}

export function destroyOnramper(): void {
  // Nothing is ever constructed off-iOS, so there is nothing to tear down.
}

/**
 * No-op off iOS: there is no SDK to hold an OnramperID login, so there is
 * nothing to sign out of. Resolves rather than rejecting — logout calls this and
 * must not be blocked by a platform that never had the flow.
 */
export function signOutOnramper(): Promise<void> {
  return Promise.resolve();
}
