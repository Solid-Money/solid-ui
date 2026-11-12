import { Href, router } from 'expo-router';

import AssetRow from '@/components/Assets/AssetRow';
import PortfolioIcon from '@/components/Assets/PortfolioIcon';
import { path } from '@/constants/path';
import { PendingWithdrawal } from '@/hooks/useBaseWithdrawRequests';
import { sumKnownValues } from '@/lib/portfolio';

/** Matches what the soUSD withdraw screen promised: "sometimes take up to 24 hours". */
export const WITHDRAWING_SUBTITLE = 'On its way to your wallet · up to 24 hours';

/**
 * A soETH request on the Base queue matches its own withdraw screen ("Usually within 3 days"), an
 * estimate rather than a maximum, since the queue does not guarantee when a solver fills it.
 */
export const WITHDRAWING_SUBTITLE_ETH = 'On its way to your wallet · usually within 3 days';

/** The longest wait among what is pending, so the row never promises sooner than any request. */
export const withdrawingSubtitle = (withdrawals: PendingWithdrawal[]) =>
  withdrawals.some(item => item.vault === 'ETH') ? WITHDRAWING_SUBTITLE_ETH : WITHDRAWING_SUBTITLE;

/** One request opens its own activity; several open the list, where each shows Processing. */
export const openPendingWithdrawals = (withdrawals: PendingWithdrawal[]) =>
  router.push(
    withdrawals.length === 1 ? (`/activity/${withdrawals[0].clientTxId}` as Href) : path.ACTIVITY,
  );

/** The total a list of pending withdrawals will pay out; undefined if any amount is unknown. */
export const pendingWithdrawalsUsd = (withdrawals: PendingWithdrawal[]) => {
  const { total, complete } = sumKnownValues(withdrawals.map(item => item.amountUsd));
  return complete ? total : undefined;
};

/**
 * soUSD and soETH withdrawals waiting in their queues: no longer savings, not yet in the wallet. Listed so
 * the rows still add up to the balance, which counts them, and the user sees where it went.
 */
export default function WithdrawingRow({ withdrawals }: { withdrawals: PendingWithdrawal[] }) {
  return (
    <AssetRow
      title="Withdrawing"
      icon={
        <PortfolioIcon kind={withdrawals.every(item => item.vault === 'ETH') ? 'eth' : 'usdc'} />
      }
      value={pendingWithdrawalsUsd(withdrawals)}
      subtitle={withdrawingSubtitle(withdrawals)}
      onPress={() => openPendingWithdrawals(withdrawals)}
    />
  );
}
