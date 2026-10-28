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

/** Successful sends, newest first, with case-insensitive contact matching. */
export function getRecentSendRecipients(
  activities: ActivityEvent[],
  addressBook: AddressBookResponse[],
): SendRecipient[] {
  const contacts = new Map(addressBook.map(entry => [entry.walletAddress.toLowerCase(), entry]));
  const latest = new Map<string, ActivityEvent>();
  for (const activity of activities) {
    if (
      ![TransactionType.SEND, TransactionType.CROSS_CHAIN_SEND].includes(activity.type) ||
      activity.status !== TransactionStatus.SUCCESS ||
      !activity.toAddress
    ) {
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
