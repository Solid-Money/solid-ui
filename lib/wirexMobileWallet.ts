import { TurboModuleRegistry } from 'react-native';

import type { WalletTopUpSdkConfig } from '@/lib/types/wallet-topup';
import type * as WirexMobileSdk from '@wirexapp/mobile-sdk';

type WirexMobileSdkModule = typeof WirexMobileSdk;
type WirexWalletConfig = WirexMobileSdk.WirexWalletConfig;

/**
 * The native modules the package's root import touches while it loads.
 *
 * `@wirexapp/mobile-sdk` re-exports its reveal and collect surfaces next to the
 * wallet, and those two resolve their TurboModules with `getEnforcing`, which
 * THROWS on a binary that does not carry them. A plain `import` would therefore
 * crash every screen that offers the top-up on an app built before the SDK was
 * added — and an over-the-air update can reach such a binary, because update
 * compatibility is keyed on the app version string, not on the native
 * fingerprint. The wallet itself needs `WirexWallet`.
 */
const REQUIRED_NATIVE_MODULES = ['WirexWallet', 'WirexReveal', 'WirexCollect'] as const;

let loaded: WirexMobileSdkModule | null | undefined;

/**
 * Wirex's React Native SDK, or `null` on a binary without its native modules.
 *
 * Checked with the soft `TurboModuleRegistry.get` first and only then required,
 * so a missing module hides the top-up instead of crashing the app. The answer
 * cannot change while the process runs, so it is worked out once.
 *
 * Imported by the `.native` wallet top-up files only: the package never reaches
 * the web bundle.
 */
export const loadWirexMobileSdk = (): WirexMobileSdkModule | null => {
  if (loaded !== undefined) return loaded;
  try {
    const linked = REQUIRED_NATIVE_MODULES.every(name => TurboModuleRegistry.get(name) != null);
    // A synchronous require so the hooks and views get their answer on first render.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = linked ? (require('@wirexapp/mobile-sdk') as WirexMobileSdkModule) : null;
  } catch {
    loaded = null;
  }
  return loaded;
};

/**
 * The native wallet SDK's config, from the backend's `sdk` block.
 */
export const toWirexMobileConfig = (
  sdk: Pick<WalletTopUpSdkConfig, 'mobileEnvironment' | 'clientId'>,
): WirexWalletConfig => ({
  environment: sdk.mobileEnvironment,
  clientId: sdk.clientId ?? undefined,
});

/**
 * Whether this binary can load Wirex's checkout for the environment.
 *
 * False without the SDK's native modules (see `loadWirexMobileSdk`), and false
 * when the SDK was built without that environment: the probe and the checkout
 * view resolve it while they render and throw when they cannot. Asking first
 * turns either into a hidden row rather than a crashed sheet.
 */
export const canLoadWirexWallet = (environment: string): boolean => {
  const sdk = loadWirexMobileSdk();
  if (!sdk) return false;
  try {
    return sdk.WirexWalletEnvironment.isAvailable(environment);
  } catch {
    return false;
  }
};
