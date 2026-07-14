import { Cashback, CashbackStatus } from '@/lib/types';

/**
 * A cashback counts as "successfully received" once it has been Paid out and
 * carries a positive soUSD payout amount. Legacy FUSE-only cashbacks are
 * intentionally excluded — the in-app review prompt is tied specifically to
 * receiving soUSD cashback.
 */
export const isReceivedSoUsdCashback = (cashback: Cashback): boolean => {
  if (cashback.status !== CashbackStatus.Paid) return false;
  const soUsdAmount = cashback.soUsdAmount ? parseFloat(cashback.soUsdAmount) : 0;
  return soUsdAmount > 0;
};

/** Ids of every cashback that represents a successfully received soUSD payout. */
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
