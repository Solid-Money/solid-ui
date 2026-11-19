import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useWalletDeviceAvailability } from '@/hooks/useWalletDeviceAvailability';
import { useWalletTopUpAvailability } from '@/hooks/useWalletTopUpAvailability';
import { track } from '@/lib/analytics';
import {
  getWalletTopUpPlatform,
  resolveWalletTopUpEntry,
  WALLET_TOPUP_WALLET_APP,
  WalletTopUpEntry,
} from '@/lib/walletTopUp';
import { useWalletTopUpStore, WalletTopUpSource } from '@/store/useWalletTopUpStore';

/**
 * Whether to offer the Apple Pay / Google Pay top-up row, and with which wallet.
 *
 * Both answers have to be yes: the backend's (this user, this cohort, an active
 * Wirex capability) and the device's (Wirex's probe says it can pay). Hidden
 * while either is loading and on any error. On native the device answer only
 * arrives while `WalletTopUpProbe` is mounted, so render it beside the row.
 *
 * `recheck` asks the device again, past the SDK's caches — for an Android
 * browser that was told to add a card to Google Wallet first.
 */
export const useCanWalletTopUp = (): WalletTopUpEntry & { recheck: () => Promise<void> } => {
  const { availability, isAvailable } = useWalletTopUpAvailability();
  const { device, recheck } = useWalletDeviceAvailability(availability);

  return useMemo(
    () => ({
      ...resolveWalletTopUpEntry(getWalletTopUpPlatform(Platform.OS), isAvailable, device),
      recheck,
    }),
    [device, isAvailable, recheck],
  );
};

/**
 * The top-up row, for a screen that shows one: whether to show it, and what a tap
 * does. Both rows open the same steps; `open` is how the screen gets to the first
 * of them — the deposit modal's own step, or the card modal's embedded one.
 *
 * `isShown` is for a host mounted before its row is on screen (a closed modal),
 * so the row is only reported as seen when it is.
 */
export const useWalletTopUpEntry = (
  source: WalletTopUpSource,
  open: () => void,
  isShown = true,
) => {
  const entry = useCanWalletTopUp();
  const { visible, method, needsCard, recheck } = entry;

  useEffect(() => {
    if (!visible || !isShown) return;
    track(TRACKING_EVENTS.WALLET_TOPUP_ROW_VIEWED, {
      source,
      payment_method: method,
      needs_card: needsCard,
    });
  }, [isShown, method, needsCard, source, visible]);

  const onPress = useCallback(() => {
    if (needsCard) {
      // Google Pay works here, but no card in Google Wallet qualifies yet. Nothing
      // to check out with until there is; ask again for when they come back.
      Toast.show({
        type: 'info',
        text1: `Add a card to ${WALLET_TOPUP_WALLET_APP[method]} first`,
        text2: 'Then come back here to top up.',
      });
      void recheck();
      return;
    }
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'wallet_topup',
      provider: 'wirex',
      payment_method: method,
      source,
    });
    useWalletTopUpStore.getState().start(method, source);
    open();
  }, [method, needsCard, open, recheck, source]);

  return { ...entry, onPress };
};

export default useCanWalletTopUp;
