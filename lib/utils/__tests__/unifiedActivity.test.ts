/// <reference types="jest" />
import {
  ActivityEvent,
  ActivityTab,
  CardTransaction,
  CardTransactionCategory,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import {
  filterUnifiedActivity,
  getCardTransactionTimestamp,
  getUnifiedActivitySearchText,
  mergeActivityFeeds,
} from '@/lib/utils/unifiedActivity';

const activity = (overrides: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({
    clientTxId: 'tx-1',
    title: 'USDC',
    timestamp: '1000',
    type: TransactionType.SEND,
    status: TransactionStatus.SUCCESS,
    amount: '31.46',
    symbol: 'USDC',
    ...overrides,
  }) as ActivityEvent;

const cardTransaction = (overrides: Partial<CardTransaction> = {}): CardTransaction =>
  ({
    id: 'card-1',
    card_account_id: 'acct',
    customer_id: 'cust',
    category: CardTransactionCategory.PURCHASE,
    amount: '-31.46',
    currency: 'USD',
    status: 'approved',
    description: 'MCDONALDS',
    posted_at: new Date(2_000_000).toISOString(),
    authorized_at: new Date(2_000_000).toISOString(),
    related_transaction_ids: [],
    merchant_name: "McDonald's",
    merchant_city: 'Tel Aviv',
    merchant_country: 'IL',
    ...overrides,
  }) as CardTransaction;

describe('getCardTransactionTimestamp', () => {
  it('dates an approved transaction from its authorization', () => {
    const transaction = cardTransaction({
      status: 'approved',
      authorized_at: new Date(5_000).toISOString(),
      posted_at: new Date(9_000).toISOString(),
    });

    expect(getCardTransactionTimestamp(transaction)).toBe(5);
  });

  it('dates a declined transaction from its posting, which is all it has', () => {
    const transaction = cardTransaction({
      status: 'declined',
      authorized_at: new Date(5_000).toISOString(),
      posted_at: new Date(9_000).toISOString(),
    });

    expect(getCardTransactionTimestamp(transaction)).toBe(9);
  });

  it('falls back to now rather than NaN when neither date parses', () => {
    const transaction = cardTransaction({ authorized_at: '', posted_at: '' });

    expect(Number.isNaN(getCardTransactionTimestamp(transaction))).toBe(false);
  });
});

describe('mergeActivityFeeds', () => {
  it('interleaves wallet and card rows newest first', () => {
    const items = mergeActivityFeeds(
      [
        activity({ clientTxId: 'old', timestamp: '1' }),
        activity({ clientTxId: 'new', timestamp: '3' }),
      ],
      [cardTransaction({ id: 'mid', authorized_at: new Date(2_000).toISOString() })],
    );

    expect(items.map(item => item.id)).toEqual(['new', 'card-mid', 'old']);
  });

  it('files a card withdrawal under Card even though it is a wallet activity', () => {
    const [item] = mergeActivityFeeds([activity({ type: TransactionType.CARD_WITHDRAWAL })], []);

    expect(item.kind).toBe('wallet');
    expect(item.tab).toBe(ActivityTab.CARD);
  });

  it('drops the issuer-side copy of a withdrawal the wallet already reports', () => {
    const items = mergeActivityFeeds(
      [],
      [cardTransaction({ category: CardTransactionCategory.CRYPTO_WITHDRAWAL })],
    );

    expect(items).toHaveLength(0);
  });

  it('drops a funding row whose on-chain hash is already a wallet activity', () => {
    const items = mergeActivityFeeds(
      [activity({ clientTxId: 'deposit', hash: '0xABC' })],
      [
        cardTransaction({
          category: CardTransactionCategory.CRYPTO_FUNDING,
          crypto_transaction_details: {
            tx_hash: '0xabc',
          } as CardTransaction['crypto_transaction_details'],
        }),
      ],
    );

    expect(items.map(item => item.id)).toEqual(['deposit']);
  });

  it('keeps a funding row whose hash matches nothing in the wallet', () => {
    const items = mergeActivityFeeds(
      [activity({ hash: '0xdef' })],
      [
        cardTransaction({
          category: CardTransactionCategory.CRYPTO_FUNDING,
          crypto_transaction_details: {
            tx_hash: '0xabc',
          } as CardTransaction['crypto_transaction_details'],
        }),
      ],
    );

    expect(items).toHaveLength(2);
  });
});

describe('filterUnifiedActivity', () => {
  const items = mergeActivityFeeds(
    [
      activity({ clientTxId: 'wallet-send', title: 'USDC', timestamp: '3' }),
      activity({ clientTxId: 'card-out', type: TransactionType.CARD_WITHDRAWAL, timestamp: '2' }),
    ],
    [cardTransaction({ id: 'nike', merchant_name: 'Nike', merchant_city: 'Berlin' })],
  );

  it('shows everything on All', () => {
    expect(filterUnifiedActivity(items, { tab: ActivityTab.ALL })).toHaveLength(3);
  });

  it('keeps card withdrawals out of the Wallet chip', () => {
    const walletItems = filterUnifiedActivity(items, { tab: ActivityTab.WALLET });

    expect(walletItems.map(item => item.id)).toEqual(['wallet-send']);
  });

  it('puts card withdrawals and card spend under the Card chip', () => {
    const cardItems = filterUnifiedActivity(items, { tab: ActivityTab.CARD });

    expect(cardItems.map(item => item.id).sort()).toEqual(['card-nike', 'card-out']);
  });

  it('searches merchants, places and tokens regardless of case', () => {
    expect(filterUnifiedActivity(items, { tab: ActivityTab.ALL, query: 'nike' })).toHaveLength(1);
    expect(filterUnifiedActivity(items, { tab: ActivityTab.ALL, query: 'BERLIN' })).toHaveLength(1);
    // Both wallet rows in this fixture are denominated in USDC.
    expect(filterUnifiedActivity(items, { tab: ActivityTab.ALL, query: 'usdc' })).toHaveLength(2);
  });

  it('treats a blank query as no search', () => {
    expect(filterUnifiedActivity(items, { tab: ActivityTab.ALL, query: '   ' })).toHaveLength(3);
  });

  it('applies the chip and the search together', () => {
    expect(filterUnifiedActivity(items, { tab: ActivityTab.WALLET, query: 'nike' })).toHaveLength(
      0,
    );
  });
});

describe('getUnifiedActivitySearchText', () => {
  it('falls back to the issuer description when a card row has no merchant', () => {
    const [item] = mergeActivityFeeds(
      [],
      [cardTransaction({ merchant_name: undefined, description: 'ATM FEE' })],
    );

    expect(getUnifiedActivitySearchText(item)).toContain('atm fee');
  });
});
