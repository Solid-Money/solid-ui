import { isProtocolAddress } from '@/lib/protocolAddresses';
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
 * and a deposit pull are indexed as plain sends to our own contracts (the
 * BridgePaymaster, the backend smart accounts); offering those as recipients
 * sent users' funds to them, so they never count.
 */
export function isRecentSendActivity(
  activity: ActivityEvent,
): activity is ActivityEvent & { toAddress: string } {
  return (
    [TransactionType.SEND, TransactionType.CROSS_CHAIN_SEND].includes(activity.type) &&
    activity.status === TransactionStatus.SUCCESS &&
    !!activity.toAddress &&
    !isProtocolAddress(activity.toAddress)
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

/**
 * The network a send to this address is expected to land on, or undefined for
 * an address with no history: the network the user picked for it in the bridge
 * flow, else the network shown on its recipient row (the saved contact's, else
 * the last send's — the receiving network for a cross-chain send).
 *
 * The regular send always executes on the picked token's chain, so a recipient
 * last paid on Arbitrum (often an exchange deposit address) could be sent USDC
 * on Base without a word; Review compares the two with this.
 */
export function getExpectedRecipientChainId(
  walletAddress: string | undefined,
  activities: ActivityEvent[],
  addressBook: AddressBookResponse[],
  pickedChainId?: number | null,
): number | undefined {
  if (pickedChainId) return pickedChainId;
  if (!walletAddress) return undefined;
  const key = walletAddress.toLowerCase();
  return (
    getRecentSendRecipients(activities, addressBook).find(
      recipient => recipient.walletAddress.toLowerCase() === key,
    )?.chainId ?? addressBook.find(entry => entry.walletAddress.toLowerCase() === key)?.chainId
  );
}
