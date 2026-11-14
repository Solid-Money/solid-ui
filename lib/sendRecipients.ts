import { isSolidSystemAddress } from '@/lib/protocolAddresses';
import {
  ActivityEvent,
  AddressBookResponse,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';

export interface SendRecipient {
  walletAddress: string;
  name?: string;
  chainId?: number;
  saved: boolean;
}

/**
 * A successful send to someone, as a recent recipient. A bridge's source leg
 * is indexed as a plain send to our BridgePaymaster, a deposit from a wallet as
 * one to our relayer, and a card settlement as one to our treasury. None of
 * them is anyone's wallet, and offering the first two as recipients already
 * sent users' funds to them, so none counts.
 */
export function isRecentSendActivity(
  activity: ActivityEvent,
): activity is ActivityEvent & { toAddress: string } {
  return (
    [TransactionType.SEND, TransactionType.CROSS_CHAIN_SEND].includes(activity.type) &&
    activity.status === TransactionStatus.SUCCESS &&
    !!activity.toAddress &&
    !isSolidSystemAddress(activity.toAddress)
  );
}

/** Successful sends, newest first, with case-insensitive contact matching. */
export function getRecentSendRecipients(
  activities: ActivityEvent[],
  addressBook: AddressBookResponse[],
): SendRecipient[] {
  const contacts = new Map(addressBook.map(entry => [entry.walletAddress.toLowerCase(), entry]));
  const latest = new Map<string, ActivityEvent>();
  for (const activity of activities) {
    if (!isRecentSendActivity(activity)) {
      continue;
    }
    const key = activity.toAddress.toLowerCase();
    if (!latest.has(key) || Number(activity.timestamp) > Number(latest.get(key)!.timestamp)) {
      latest.set(key, activity);
    }
  }
  return [...latest.values()]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .map(activity => {
      const contact = contacts.get(activity.toAddress!.toLowerCase());
      const destinationChainId = activity.metadata?.dstChainId;
      return {
        walletAddress: activity.toAddress!,
        name: contact?.name,
        chainId:
          contact?.chainId ??
          (typeof destinationChainId === 'number' ? destinationChainId : activity.chainId),
        saved: !!contact,
      };
    });
}
