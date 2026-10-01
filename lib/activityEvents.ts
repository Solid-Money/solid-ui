import { ActivityEvent } from '@/lib/types';

/** Keep REST pages, manual refreshes and live events in the same store format. */
export function constructActivity(tx: ActivityEvent, safeAddress: string): ActivityEvent {
  let clientTxId = `${tx.type}-${tx.timestamp}`;
  if ('trackingId' in tx && tx.trackingId) {
    clientTxId = tx.trackingId as string;
  } else if (tx.clientTxId) {
    clientTxId = tx.clientTxId;
  } else if (tx.hash) {
    clientTxId = `${tx.type}-${tx.hash}`;
  }

  return {
    ...tx,
    clientTxId,
    title: tx.title || `${tx.type} Transaction`,
    timestamp: tx.timestamp || Math.floor(Date.now() / 1000).toString(),
    amount: tx.amount != null ? tx.amount.toString() : '0',
    symbol: tx.symbol || 'USDC',
    fromAddress: tx.fromAddress || safeAddress,
  };
}
