import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkWalletAvailability } from '@wirexapp/card-wallet-topup-web';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';
import type { WalletDeviceAvailability } from '@/lib/walletTopUp';
import type { CheckWalletAvailabilityOptions } from '@wirexapp/card-wallet-topup-web';

const WALLET_DEVICE_QUERY_KEY = 'walletTopUpDevice';
const LAST_PROBED_CONFIG_PREFIX = 'walletTopUpDevice.config:';

/**
 * The provider block the SDK last probed for this environment and client, kept
 * in localStorage beside the SDK's own cache. The SDK caches its answer per
 * frame (and the last real one in localStorage), not per block, so its cache
 * is trusted only when we know it answered for this very block: a different
 * block, or no record at all (a browser that cached an answer before this was
 * remembered, or storage that can't be read), forces a fresh probe. Failing
 * storage costs a probe, never a stale answer.
 */
const lastProbedConfig = {
  key: (environment?: string, clientId?: string | null) =>
    `${LAST_PROBED_CONFIG_PREFIX}${environment ?? ''}:${clientId ?? ''}`,
  read(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  write(key: string, value: string) {
    try {
      globalThis.localStorage?.setItem(key, value);
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
    // The SDK's cache only for the block we know it answered for.
    queryFn: async () => {
      const storageKey = lastProbedConfig.key(environment, clientId);
      const current = JSON.stringify(walletConfig ?? null);
      const answer = await probe(lastProbedConfig.read(storageKey) !== current);
      lastProbedConfig.write(storageKey, current);
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
