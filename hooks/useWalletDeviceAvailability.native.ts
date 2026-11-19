import { useMemo } from 'react';

import {
  canLoadWirexWallet,
  loadWirexMobileSdk,
  toWirexMobileConfig,
} from '@/lib/wirexMobileWallet';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';
import type { WalletDeviceAvailability } from '@/lib/walletTopUp';
import type { WirexWalletConfig } from '@wirexapp/mobile-sdk';

/** Only read while the hook is disabled, which never touches it. */
const IDLE_CONFIG: WirexWalletConfig = { environment: 'production' };

const recheck = async () => {};

/** Stands in for the SDK's hook on a binary without it: never an answer. */
const useNoWalletAvailability = (): null => null;

/**
 * The SDK's availability hook, or the stand-in. Chosen once per process — the
 * binary either carries the SDK or it does not — so the same hook runs on every
 * render.
 */
const useWalletAvailability =
  loadWirexMobileSdk()?.useWalletAvailability ?? useNoWalletAvailability;

/**
 * Native: what this phone can pay with, as Wirex's availability probe answered.
 *
 * The probe itself is `WalletTopUpProbe`, mounted by the screens that show the
 * row; this only listens, and reads null until the probe has answered. Masked by
 * the provider's block, so a wallet the provider does not offer reads false.
 */
export const useWalletDeviceAvailability = (
  availability: WalletTopUpAvailability | undefined,
): { device: WalletDeviceAvailability | null; recheck: () => Promise<void> } => {
  const environment = availability?.sdk?.mobileEnvironment;
  const clientId = availability?.sdk?.clientId ?? null;
  const walletConfig = availability?.walletConfig ?? undefined;

  const config = useMemo(
    () => (environment ? toWirexMobileConfig({ mobileEnvironment: environment, clientId }) : null),
    [clientId, environment],
  );
  const isLoadable = useMemo(() => !!config && canLoadWirexWallet(config.environment), [config]);

  const answer = useWalletAvailability(config ?? IDLE_CONFIG, {
    providerConfig: walletConfig,
    enabled: isLoadable && !!walletConfig,
  });

  const device = useMemo<WalletDeviceAvailability | null>(
    () =>
      answer
        ? {
            applePay: answer.applePay,
            googlePay: answer.googlePay,
            googlePayHandoff: false,
            googlePayNeedsCard: false,
          }
        : null,
    [answer],
  );

  return { device, recheck };
};
