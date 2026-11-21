import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkWalletAvailability } from '@wirexapp/card-wallet-topup-web';

import type { WalletTopUpAvailability } from '@/lib/types/wallet-topup';
import type { WalletDeviceAvailability } from '@/lib/walletTopUp';
import type { CheckWalletAvailabilityOptions } from '@wirexapp/card-wallet-topup-web';

const WALLET_DEVICE_QUERY_KEY = 'walletTopUpDevice';
const REMEMBERED_KEY = 'walletTopUpDevice.answer';

const isDevice = (value: unknown): value is WalletDeviceAvailability => {
  const device = value as Partial<WalletDeviceAvailability> | null;
  return (
    typeof device?.applePay === 'boolean' &&
    typeof device.googlePay === 'boolean' &&
    typeof device.googlePayHandoff === 'boolean' &&
    typeof device.googlePayNeedsCard === 'boolean'
  );
};

/**
 * The last answer this browser got, kept WITH what it was probed for —
 * environment, client, provider and block — in one localStorage write, so the
 * two can never come apart. It is shown for exactly that identity, and only
 * while a fresh probe runs; a record any tab wrote for anything else is a miss.
 *
 * It replaces the SDK's own caches, which every probe here skips (`force`):
 * the SDK keeps one answer per frame origin in localStorage and one per frame
 * URL in memory, whatever the client or block, and the background
 * revalidation it starts whenever it serves one — in this tab or another —
 * can refill them for a different identity at any time. Nothing ties what is
 * in them to what we asked. Storage that fails costs the instant answer,
 * never a wrong one.
 */
const remembered = {
  read(identity: string): WalletDeviceAvailability | undefined {
    try {
      const raw = globalThis.localStorage?.getItem(REMEMBERED_KEY);
      const record = raw ? (JSON.parse(raw) as { identity?: unknown; device?: unknown }) : null;
      return record?.identity === identity && isDevice(record.device) ? record.device : undefined;
    } catch {
      return undefined;
    }
  },
  write(identity: string, device: WalletDeviceAvailability) {
    try {
      globalThis.localStorage?.setItem(REMEMBERED_KEY, JSON.stringify({ identity, device }));
    } catch {
      // Not remembered: the next load waits for its probe.
    }
  },
};

/**
 * Web: what this browser can pay with, from Wirex's hidden probe frame.
 *
 * Asked with the default provider's block, before any quote exists, so the
 * Google Pay check runs on the provider's own parameters. Probed afresh once
 * per page load (the answer is kept for the session, so reopening the sheet
 * asks nothing); until it answers, the answer this browser last got for the
 * very same environment, client and block stands in.
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
  const identity = useMemo(
    () => JSON.stringify([environment, clientId, provider, walletConfig]),
    [clientId, environment, provider, walletConfig],
  );

  // Always past the SDK's caches; the answer is remembered with what it answered.
  const probe = useCallback(async (): Promise<WalletDeviceAvailability> => {
    const answer = await checkWalletAvailability(
      { environment, clientId: clientId ?? undefined },
      {
        // Verbatim: the probe copies the provider's Google Pay values unchanged.
        config: (walletConfig ?? undefined) as CheckWalletAvailabilityOptions['config'],
        force: true,
      },
    );
    const device = {
      applePay: answer.applePay,
      googlePay: answer.googlePay,
      googlePayHandoff: answer.googlePayHandoff === true,
      googlePayNeedsCard: answer.googlePayState === 'needs_card',
    };
    remembered.write(identity, device);
    return device;
  }, [clientId, environment, identity, walletConfig]);

  const { data, isError } = useQuery({
    queryKey,
    queryFn: probe,
    // Shown only while the probe runs, and only for this exact identity.
    placeholderData: () => remembered.read(identity),
    enabled: canProbe,
    staleTime: Infinity,
    retry: false,
  });

  // After the user adds a card to Google Wallet: ask again.
  const recheck = useCallback(async () => {
    if (!canProbe) return;
    try {
      queryClient.setQueryData(queryKey, await probe());
    } catch {
      // The previous answer stands.
    }
  }, [canProbe, probe, queryClient, queryKey]);

  return { device: canProbe && !isError ? (data ?? null) : null, recheck };
};
