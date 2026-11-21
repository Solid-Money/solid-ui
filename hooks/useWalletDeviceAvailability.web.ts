import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkWalletAvailability } from '@wirexapp/card-wallet-topup-web';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';
import type { WalletDeviceAvailability } from '@/lib/walletTopUp';
import type { CheckWalletAvailabilityOptions } from '@wirexapp/card-wallet-topup-web';

const WALLET_DEVICE_QUERY_KEY = 'walletTopUpDevice';
const LAST_PROBE_KEY = 'walletTopUpDevice.lastProbe';

/**
 * What the SDK's cached answer in this browser was probed for: environment,
 * client and provider block, in ONE slot. The SDK keeps one answer per frame
 * origin in localStorage (and one per frame URL in memory), whatever the client
 * or block, so its cache is trusted only when this holds exactly the current
 * three. Anything else, or no record (an answer cached before this was kept,
 * storage that can't be read), forces a fresh probe.
 *
 * A change is probed fresh and then remembered as unknown, not as the new
 * identity: whenever the SDK serves a cached answer it revalidates it in the
 * background, and that probe — for the identity before the change — can land
 * after ours and put the old answer back in its slot. The next load probes
 * fresh again and records the identity. Failing storage costs a probe, never
 * a stale answer.
 */
const lastProbe = {
  read(): string | null {
    try {
      return globalThis.localStorage?.getItem(LAST_PROBE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  write(identity: string | null) {
    try {
      if (identity === null) globalThis.localStorage?.removeItem(LAST_PROBE_KEY);
      else globalThis.localStorage?.setItem(LAST_PROBE_KEY, identity);
    } catch {
      // Not remembered: the next probe forces past the SDK's cache.
    }
  },
};

/**
 * Web: what this browser can pay with, from Wirex's hidden probe frame.
 *
 * Asked with the default provider's block, before any quote exists, so the
 * Google Pay check runs on the provider's own parameters. The SDK caches the
 * answer per page session (and the last real one in localStorage), so asking
 * again on every open of the sheet costs nothing.
 *
 * The frame only loads with Wirex's company id, which QA does not have: with no
 * `clientId` the answer is null and the row stays hidden.
 */
export const useWalletDeviceAvailability = (
  availability: WalletTopUpAvailability | undefined,
): { device: WalletDeviceAvailability | null; recheck: () => Promise<void> } => {
  const queryClient = useQueryClient();
  const environment = availability?.sdk?.webEnvironment;
  const clientId = availability?.sdk?.clientId;
  const provider = availability?.provider;
  const walletConfig = availability?.walletConfig;
  const canProbe = !!environment && !!clientId && !!walletConfig;

  // The provider's block is in the key because the probe answers for it: a new one
  // asks again. React Query hashes it by value, and its structural sharing keeps
  // the object's identity while a refetch returns the same block.
  const queryKey = useMemo(
    () => [WALLET_DEVICE_QUERY_KEY, environment, clientId, provider, walletConfig],
    [clientId, environment, provider, walletConfig],
  );

  const probe = useCallback(
    async (force: boolean): Promise<WalletDeviceAvailability> => {
      const answer = await checkWalletAvailability(
        { environment, clientId: clientId ?? undefined },
        {
          // Verbatim: the probe copies the provider's Google Pay values unchanged.
          config: (walletConfig ?? undefined) as CheckWalletAvailabilityOptions['config'],
          force,
        },
      );
      return {
        applePay: answer.applePay,
        googlePay: answer.googlePay,
        googlePayHandoff: answer.googlePayHandoff === true,
        googlePayNeedsCard: answer.googlePayState === 'needs_card',
      };
    },
    [clientId, environment, walletConfig],
  );

  const { data, isError } = useQuery({
    queryKey,
    // The SDK's cache only for what we know it answered for.
    queryFn: async () => {
      const identity = JSON.stringify([environment, clientId, walletConfig]);
      const last = lastProbe.read();
      const answer = await probe(last !== identity);
      lastProbe.write(last === null || last === identity ? identity : null);
      return answer;
    },
    enabled: canProbe,
    staleTime: Infinity,
    retry: false,
  });

  // After the user adds a card to Google Wallet: skip the SDK's caches and ask again.
  const recheck = useCallback(async () => {
    if (!canProbe) return;
    try {
      queryClient.setQueryData(queryKey, await probe(true));
    } catch {
      // The previous answer stands.
    }
  }, [canProbe, probe, queryClient, queryKey]);

  return { device: canProbe && !isError ? (data ?? null) : null, recheck };
};
