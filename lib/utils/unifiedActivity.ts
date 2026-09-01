import {
  ActivityEvent,
  ActivityTab,
  CardTransaction,
  CardTransactionCategory,
  TransactionType,
} from '@/lib/types';
import { getCardMerchantLocation, getCardMerchantName } from '@/lib/utils/cardHelpers';

/** The chips the Activity screen filters by. `PROGRESS` is not one of them. */
export type ActivityFilter = ActivityTab.ALL | ActivityTab.WALLET | ActivityTab.CARD;

/**
 * One row of the merged feed.
 *
 * `tab` is which chip the row belongs under, and is deliberately not the same
 * thing as `kind`: a card withdrawal is a wallet activity (it moves collateral
 * out of the card, and only the activity store knows about it) that a user
 * looking for it will look for under Card.
 */
export type UnifiedActivityItem =
  | {
      kind: 'wallet';
      id: string;
      timestamp: number;
      tab: ActivityTab.WALLET | ActivityTab.CARD;
      activity: ActivityEvent;
    }
  | {
      kind: 'card';
      id: string;
      timestamp: number;
      tab: ActivityTab.CARD;
      transaction: CardTransaction;
    };

/**
 * When a card transaction happened, in the same unit as an activity's timestamp
 * (seconds). An approved transaction is dated from the authorization the user
 * remembers making; a declined or reversed one only ever has a posting date.
 */
export const getCardTransactionTimestamp = (transaction: CardTransaction): number => {
  const dateStr =
    transaction.status === 'approved'
      ? transaction.authorized_at || transaction.posted_at
      : transaction.posted_at || transaction.authorized_at;
  const parsed = dateStr ? new Date(dateStr).getTime() : NaN;
  return Number.isNaN(parsed) ? Date.now() / 1000 : parsed / 1000;
};

const normalizeHash = (hash: string | undefined | null): string | undefined =>
  hash?.toLowerCase().trim() || undefined;

/**
 * Merge wallet activity and card history into one feed, newest first.
 *
 * Two things stop the same movement of money appearing twice once the two
 * sources sit in one list:
 *
 * - `crypto_withdrawal` card rows are dropped, because the wallet side of the
 *   same withdrawal is already an activity (`CARD_WITHDRAWAL`) and it is the
 *   richer of the two — it carries the status the withdrawal screen polls.
 * - a funding row whose on-chain hash matches an activity is dropped for the
 *   same reason: the deposit the user made is the activity, and the card
 *   transaction is the issuer's view of its arrival.
 */
export const mergeActivityFeeds = (
  activities: ActivityEvent[],
  cardTransactions: CardTransaction[],
): UnifiedActivityItem[] => {
  const walletItems: UnifiedActivityItem[] = activities.map(activity => ({
    kind: 'wallet',
    id: activity.clientTxId,
    timestamp: Number(activity.timestamp) || 0,
    tab: activity.type === TransactionType.CARD_WITHDRAWAL ? ActivityTab.CARD : ActivityTab.WALLET,
    activity,
  }));

  const activityHashes = new Set(
    activities.flatMap(activity =>
      [normalizeHash(activity.hash), normalizeHash(activity.metadata?.txHash)].filter(
        (hash): hash is string => !!hash,
      ),
    ),
  );

  const cardItems: UnifiedActivityItem[] = cardTransactions
    .filter(transaction => {
      if (transaction.category === CardTransactionCategory.CRYPTO_WITHDRAWAL) return false;
      const cryptoHash = normalizeHash(transaction.crypto_transaction_details?.tx_hash);
      return !cryptoHash || !activityHashes.has(cryptoHash);
    })
    .map(transaction => ({
      kind: 'card',
      id: `card-${transaction.id}`,
      timestamp: getCardTransactionTimestamp(transaction),
      tab: ActivityTab.CARD,
      transaction,
    }));

  return [...walletItems, ...cardItems].sort((a, b) => b.timestamp - a.timestamp);
};

/** Everything on a row a search should look at: what the user can read on it. */
export const getUnifiedActivitySearchText = (item: UnifiedActivityItem): string => {
  if (item.kind === 'card') {
    return [
      getCardMerchantName(item.transaction),
      getCardMerchantLocation(item.transaction),
      item.transaction.merchant_category_label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return [item.activity.title, item.activity.symbol].filter(Boolean).join(' ').toLowerCase();
};

type FilterOptions = {
  tab: ActivityFilter;
  /** Free-text search; blank means no search is running. */
  query?: string;
};

export const filterUnifiedActivity = (
  items: UnifiedActivityItem[],
  { tab, query }: FilterOptions,
): UnifiedActivityItem[] => {
  const search = query?.trim().toLowerCase();

  return items.filter(item => {
    if (tab !== ActivityTab.ALL && item.tab !== tab) return false;
    if (!search) return true;
    return getUnifiedActivitySearchText(item).includes(search);
  });
};
