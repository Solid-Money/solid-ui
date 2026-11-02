import { Href, router } from 'expo-router';

import AssetRow from '@/components/Assets/AssetRow';
import PortfolioIcon from '@/components/Assets/PortfolioIcon';
import { path } from '@/constants/path';
import { PendingWithdrawal } from '@/hooks/useBaseWithdrawRequests';
import { sumKnownValues } from '@/lib/portfolio';

/** Matches what the withdraw screen promised: "sometimes take up to 24 hours". */
export const WITHDRAWING_SUBTITLE = 'On its way to your wallet · up to 24 hours';

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
 * soUSD withdrawals waiting in the queue: no longer savings, not yet in the wallet. Listed so
 * the rows still add up to the balance, which counts them, and the user sees where it went.
 */
export default function WithdrawingRow({ withdrawals }: { withdrawals: PendingWithdrawal[] }) {
  return (
    <AssetRow
      title="Withdrawing"
      icon={<PortfolioIcon kind="usdc" />}
      value={pendingWithdrawalsUsd(withdrawals)}
      subtitle={WITHDRAWING_SUBTITLE}
      onPress={() => openPendingWithdrawals(withdrawals)}
    />
  );
}
