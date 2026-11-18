import { Cashback, CashbackStatus } from '@/lib/types';
import { getCashbackCurrency } from '@/lib/utils/cardHelpers';

/**
 * A cashback counts as "successfully received" once it has been Paid out and
 * carries a positive payout amount in its own share token: soUSD for a USD row,
 * soEUR for a euro row. Legacy FUSE-only cashbacks are intentionally excluded —
 * the in-app review prompt is tied specifically to receiving vault-share
 * cashback.
 */
export const isReceivedSoUsdCashback = (cashback: Cashback): boolean => {
  if (cashback.status !== CashbackStatus.Paid) return false;
  const shares =
    getCashbackCurrency(cashback) === 'EUR' ? cashback.soEurAmount : cashback.soUsdAmount;
  const payout = shares ? parseFloat(shares) : 0;
  return payout > 0;
};

/** Ids of every cashback that represents a successfully received soUSD or soEUR payout. */
export const getReceivedSoUsdCashbackIds = (cashbacks: Cashback[]): string[] =>
  cashbacks.filter(isReceivedSoUsdCashback).map(cashback => cashback._id);

/** Received-payout ids that aren't already accounted for in `knownIds`. */
export const getNewlyReceivedCashbackIds = (
  receivedIds: string[],
  knownIds: Iterable<string>,
): string[] => {
  const known = new Set(knownIds);
  return receivedIds.filter(id => !known.has(id));
};
