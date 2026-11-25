import { useCallback, useEffect, useMemo, useRef } from 'react';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { getVaultKey } from '@/constants/withdraw';
import { useOpenDepositFlow } from '@/hooks/useOpenDepositFlow';
import { useTierMembership } from '@/hooks/useTierMembership';
import { useTokenPriceUsd } from '@/hooks/useToken';
import { useVaultDepositEntry } from '@/hooks/useVaultDepositEntry';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { track } from '@/lib/analytics';
import {
  activeTierBalance,
  fixedPointUsd,
  outflowWarning,
  parseTokenUnits,
  relevantTrack,
  type TierBalanceOutflowFlow,
  type TierBalanceOutflowWarning,
} from '@/lib/tierBalance';
import { type TierBalanceTrackDto, VaultType } from '@/lib/types';
import { isEarnShareToken } from '@/lib/vaults';

/**
 * The "Hold in Earn" route for the selected account, read off the membership
 * payload every tier screen already shares.
 *
 * `balance` is null for anyone the backend has not given the route to, and for
 * an older backend that does not send it: every caller renders nothing new then.
 */
export const useTierBalance = () => {
  const { data: membership } = useTierMembership();
  const balance = activeTierBalance(membership);
  const currentTier = membership?.currentTier;
  const relevant = useMemo(() => relevantTrack(balance, currentTier), [balance, currentTier]);
  return { balance, currentTier, relevant };
};

/** Where an "Add to Earn" press came from, for analytics. */
export type TierBalanceSource = 'tier_benefits' | 'earn';

/**
 * Opens the existing Earn deposit flow for the balance route's "Add to Earn".
 *
 * The route has nothing to sign, so this is the whole of its action: the same
 * deposit entry Earn's own Deposit button uses, on USD Yield.
 */
export const useAddToEarn = (source: TierBalanceSource) => {
  const { modal, onBeforeOpen } = useVaultDepositEntry(VaultType.USDC);
  const openDepositFlow = useOpenDepositFlow();

  return useCallback(
    (balanceTrack: TierBalanceTrackDto) => {
      track(TRACKING_EVENTS.TIER_BALANCE_ADD_TO_EARN_PRESSED, {
        route: 'balance',
        tier: balanceTrack.tier,
        status: balanceTrack.status,
        source,
      });
      onBeforeOpen();
      openDepositFlow({
        modal,
        source: `tier_balance_${source}`,
        buttonText: 'Add to Earn',
        preserveSelectedVault: true,
      });
    },
    [modal, onBeforeOpen, openDepositFlow, source],
  );
};

/**
 * What sending or swapping `amount` of a token takes out of Earn, in USD — 0
 * for a token that is not an Earn share (on any chain), or one the form has no
 * price for yet.
 *
 * Priced at the USD quote the form already shows. soEURC has none — it is held
 * in euros — so it is valued at its euro rate and the EURC price, both read only
 * for someone the route is staged to.
 */
export const useEarnOutflowUsd = ({
  address,
  symbol,
  amount,
  decimals,
  priceUsd,
}: {
  address: string | undefined;
  symbol: string | undefined;
  /** The amount as typed, in whole tokens. Parsed to base units, never to a float. */
  amount: string | undefined;
  /** The token's decimals, to parse `amount` with. */
  decimals: number | undefined;
  priceUsd: number | undefined;
}): number => {
  const { relevant } = useTierBalance();
  const isShare = isEarnShareToken(address);
  const isEuro = isShare && getVaultKey(symbol) === 'EUR';
  const hasQuote = (priceUsd ?? 0) > 0;
  const needsEuroPrice = !!relevant && isEuro && !hasQuote;
  const { data: eurRate } = useVaultExchangeRate('EUR', needsEuroPrice);
  const { data: eurcPriceUsd } = useTokenPriceUsd(needsEuroPrice ? 'EURC' : '');

  if (!isShare || decimals === undefined) return 0;
  const units = parseTokenUnits(amount, decimals);
  if (hasQuote) return fixedPointUsd(units, decimals, priceUsd ?? 0);
  if (isEuro) return fixedPointUsd(units, decimals, eurRate ?? 0, Number(eurcPriceUsd) || 0);
  return 0;
};

/**
 * The outflow warning for a form moving money out of Earn, and its analytics.
 *
 * `outflowUsd` is what leaves Earn, priced by the form; 0 (or undefined while it
 * cannot price it) shows nothing. The warning is reported once each time a new
 * one appears; `proceed` is called from the form's own action, and a form closed
 * after showing a warning without proceeding reports that it was cancelled.
 */
export const useTierBalanceOutflowWarning = (
  flow: TierBalanceOutflowFlow,
  outflowUsd: number | undefined,
) => {
  const { balance, currentTier } = useTierBalance();
  const warning = useMemo(
    () => outflowWarning(balance, currentTier, outflowUsd ?? 0),
    [balance, currentTier, outflowUsd],
  );

  // What the handlers and the unmount read: the warning on screen right now,
  // the last one reported, and whether the user went ahead.
  const latest = useRef<{
    warning: TierBalanceOutflowWarning | null;
    flow: TierBalanceOutflowFlow;
  }>({ warning: null, flow });
  const shown = useRef<TierBalanceOutflowWarning | null>(null);
  const proceeded = useRef(false);

  useEffect(() => {
    latest.current = { warning, flow };
    if (!warning) return;
    // Once per warning, not once per keystroke that keeps it up.
    const last = shown.current;
    if (last && last.kind === warning.kind && last.tier === warning.tier) return;
    shown.current = warning;
    track(TRACKING_EVENTS.TIER_BALANCE_OUTFLOW_WARNING_SHOWN, {
      route: 'balance',
      flow,
      kind: warning.kind,
      tier: warning.tier,
    });
  }, [warning, flow]);

  const proceed = useCallback(() => {
    proceeded.current = true;
    const { warning: active, flow: activeFlow } = latest.current;
    if (!active) return;
    track(TRACKING_EVENTS.TIER_BALANCE_OUTFLOW_WARNING_PROCEEDED, {
      route: 'balance',
      flow: activeFlow,
      kind: active.kind,
      tier: active.tier,
    });
  }, []);

  useEffect(
    () => () => {
      // Read at unmount on purpose: the last warning shown, and whether the
      // user went ahead after it.
      const last = shown.current;
      if (!last || proceeded.current) return;
      track(TRACKING_EVENTS.TIER_BALANCE_OUTFLOW_WARNING_CANCELLED, {
        route: 'balance',
        flow: latest.current.flow,
        kind: last.kind,
        tier: last.tier,
      });
    },
    [],
  );

  return { warning, proceed };
};
