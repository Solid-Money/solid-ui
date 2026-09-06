import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { replaceRail } from '@/components/WirexBankAccount/railPresentation';
import {
  activateWirexBankAccount,
  completeWirexWalletLink,
  createWirexBankTransfer,
  estimateWirexBankTransfer,
  getWirexBankOverview,
  getWirexBankTransfers,
  initWirexWalletLink,
} from '@/lib/api';
import {
  WirexBankAccountType,
  WirexBankOverviewDto,
  WirexBankTransferEstimateRequest,
  WirexBankTransferExecuteRequest,
  WirexUnifiedBalanceDto,
} from '@/lib/types/wirex-bank';
import { withRefreshToken } from '@/lib/utils';

export const WIREX_BANK_OVERVIEW_KEY = 'wirexBankOverview';
const WIREX_BANK_TRANSFERS_KEY = 'wirexBankTransfers';

/**
 * How often the overview re-polls while a rail is still provisioning.
 *
 * Wirex issues requisites asynchronously and "logs but does not automatically
 * retry" a failed webhook delivery, so a missed delivery would otherwise leave
 * the user staring at "Setting up your account" forever. Polling only while
 * something is actually pending keeps that recovery cheap.
 */
const PENDING_POLL_INTERVAL_MS = 15_000;

/** Per-rail capability state plus any provisioned requisites. */
export function useWirexBankOverview(enabled = true) {
  return useQuery({
    queryKey: [WIREX_BANK_OVERVIEW_KEY],
    queryFn: () => withRefreshToken(() => getWirexBankOverview()),
    enabled,
    retry: 1,
    refetchInterval: query => {
      const data = query.state.data as WirexBankOverviewDto | undefined;
      const hasPendingRail = data?.rails?.some(rail => rail.isPending);
      return hasPendingRail ? PENDING_POLL_INTERVAL_MS : false;
    },
  });
}

/**
 * Kill switch for the bank balance rows.
 *
 * Off until the balance is proven to be the user's own. It comes from Wirex's
 * `GET /api/v1/wallet`, which takes no wallet argument — the scoping rests
 * entirely on the `X-User-Wallet` header being honoured there, on an endpoint
 * found by probing rather than from Wirex's docs. The response names the wallet
 * it answered for (`wallet_address`, `wallet_type`) and the backend drops both,
 * so a partner-level wallet would be surfaced verbatim and every Wirex user
 * would see the same figure.
 *
 * Showing the pooled float as a user's balance is worse than showing nothing:
 * some of them will read it as their money and try to move it.
 *
 * To re-enable: confirm `wallet_address` differs between two Wirex users and
 * matches what `/api/v1/bank/accounts/init` reports for each, add the matching
 * guard server-side, then flip this to `true`.
 */
const BANK_BALANCES_ENABLED = false;

/**
 * The WEUR/WUSD the user's bank deposits settled into.
 *
 * Reuses the overview query rather than adding a request: the home screen and
 * the bank screen then share one cache entry, and a deposit that lands while the
 * bank screen polls updates the home rows for free.
 *
 * Returns `[]` for everyone without a Wirex account, and also when Wirex could
 * not be reached — the backend cannot tell a client "unknown" any other way, and
 * both cases mean the same thing here: show no bank rows rather than a zero.
 *
 * While {@link BANK_BALANCES_ENABLED} is off it returns `[]` for everyone and
 * the query does not run — the home screen is the only caller, so the switch
 * takes out the request as well as the rows. The bank screen's own use of
 * {@link useWirexBankOverview} is untouched.
 */
export function useWirexUnifiedBalances(enabled = true) {
  const { data, isLoading } = useWirexBankOverview(enabled && BANK_BALANCES_ENABLED);
  return {
    balances: BANK_BALANCES_ENABLED ? (data?.balances ?? EMPTY_BALANCES) : EMPTY_BALANCES,
    isLoading,
  };
}

/** Stable identity, so the memo in the breakdown does not re-run every render. */
const EMPTY_BALANCES: WirexUnifiedBalanceDto[] = [];

/** One rail out of the overview, or undefined while it loads. */
export function useWirexBankRail(accountType: WirexBankAccountType) {
  const query = useWirexBankOverview();
  const rail = useMemo(
    () => query.data?.rails.find(item => item.accountType === accountType),
    [query.data, accountType],
  );
  return { ...query, rail };
}

/**
 * Provision a rail.
 *
 * The backend is idempotent, so this is safe to fire on a screen open as well
 * as on a button press.
 */
export function useActivateWirexBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountType: WirexBankAccountType) =>
      withRefreshToken(() => activateWirexBankAccount(accountType)),
    onSuccess: rail => {
      if (!rail) return;
      // Patch the one rail rather than invalidating: activation returns the
      // rail's full new state, and a refetch would flash the old one first.
      queryClient.setQueryData<WirexBankOverviewDto>([WIREX_BANK_OVERVIEW_KEY], previous =>
        replaceRail(previous, rail),
      );
    },
  });
}

/** Step 1 of wallet-linked activation: fetch the challenge to sign. */
export function useInitWirexWalletLink() {
  return useMutation({
    mutationFn: () => withRefreshToken(() => initWirexWalletLink()),
  });
}

/** Step 3 of wallet-linked activation: submit the signature. */
export function useCompleteWirexWalletLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signedChallenge: string) =>
      withRefreshToken(() => completeWirexWalletLink(signedChallenge)),
    onSuccess: rail => {
      if (!rail) return;
      queryClient.setQueryData<WirexBankOverviewDto>([WIREX_BANK_OVERVIEW_KEY], previous =>
        replaceRail(previous, rail),
      );
    },
  });
}

/**
 * Price a transfer.
 *
 * A mutation rather than a query: it is a POST that mints a server-side
 * estimation id, so it must not be cached, deduplicated or replayed on focus.
 */
export function useEstimateWirexBankTransfer() {
  return useMutation({
    mutationFn: (request: WirexBankTransferEstimateRequest) =>
      withRefreshToken(() => estimateWirexBankTransfer(request)),
  });
}

/** Execute a priced transfer. */
export function useCreateWirexBankTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: WirexBankTransferExecuteRequest) =>
      withRefreshToken(() => createWirexBankTransfer(request)),
    onSuccess: () => {
      // The new transfer is Pending and its balance effect lands via webhook,
      // so both the history and the overview are stale now.
      void queryClient.invalidateQueries({
        queryKey: [WIREX_BANK_TRANSFERS_KEY],
      });
      void queryClient.invalidateQueries({
        queryKey: [WIREX_BANK_OVERVIEW_KEY],
      });
    },
  });
}

/** Outbound transfer history, newest first. */
export function useWirexBankTransfers(limit?: number, enabled = true) {
  return useQuery({
    queryKey: [WIREX_BANK_TRANSFERS_KEY, limit ?? null],
    queryFn: () => withRefreshToken(() => getWirexBankTransfers(limit)),
    enabled,
    retry: 1,
  });
}
