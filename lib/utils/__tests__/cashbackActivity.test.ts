/// <reference types="jest" />
import {
  ActivityEvent,
  Cashback,
  CashbackStatus,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import {
  collectCashbackPayoutHashes,
  getCashbackPurchaseId,
  isCashbackPayoutActivity,
} from '@/lib/utils/cashbackActivity';
import { TransferContextKind } from '@/lib/utils/transferPresentation';

const PAYOUT_HASH = '0xAbC123';

const cashback = (overrides: Partial<Cashback> = {}): Cashback =>
  ({
    _id: 'cb-1',
    transactionId: 'card-tx-1',
    status: CashbackStatus.Paid,
    soUsdAmount: '0.94',
    payoutTxHash: PAYOUT_HASH,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  }) as Cashback;

const activity = (overrides: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({
    clientTxId: 'webhook_122_0xabc123_incoming',
    title: 'Receive soUSD',
    timestamp: '1000',
    type: TransactionType.RECEIVE,
    status: TransactionStatus.SUCCESS,
    amount: '0.94',
    symbol: 'soUSD',
    hash: PAYOUT_HASH,
    ...overrides,
  }) as ActivityEvent;

describe('collectCashbackPayoutHashes', () => {
  it('lowercases every payout hash so a mixed-case activity still matches', () => {
    expect(collectCashbackPayoutHashes([cashback()])).toEqual(new Set(['0xabc123']));
  });

  it('is empty when the cashbacks have not loaded', () => {
    expect(collectCashbackPayoutHashes(undefined).size).toBe(0);
  });

  it('leaves out rows that never paid out on-chain', () => {
    const hashes = collectCashbackPayoutHashes([
      cashback({ _id: 'cb-escrowed', status: CashbackStatus.Escrowed, payoutTxHash: undefined }),
      // Settled against cashback debt: the field carries a sentinel, not a hash.
      cashback({
        _id: 'cb-debt',
        status: CashbackStatus.DeductedFromDebt,
        payoutTxHash: 'DEDUCTED_FROM_DEBT',
      }),
    ]);

    expect(hashes.size).toBe(0);
  });
});

describe('isCashbackPayoutActivity', () => {
  const hashes = collectCashbackPayoutHashes([cashback()]);

  it('matches the receive the payout landed as, whatever case the hash is in', () => {
    expect(isCashbackPayoutActivity(activity({ hash: '0xABC123' }), hashes)).toBe(true);
  });

  it('matches a payout whose hash is only on the metadata', () => {
    expect(
      isCashbackPayoutActivity(
        activity({ hash: undefined, metadata: { txHash: PAYOUT_HASH } }),
        hashes,
      ),
    ).toBe(true);
  });

  it('leaves an unrelated incoming transfer alone', () => {
    expect(isCashbackPayoutActivity(activity({ hash: '0xdeadbeef' }), hashes)).toBe(false);
  });

  it('never matches an activity that carries no hash', () => {
    expect(isCashbackPayoutActivity(activity({ hash: undefined }), hashes)).toBe(false);
    // Not even against a sentinel-only cashback list, which is itself empty.
    const debtOnly = collectCashbackPayoutHashes([
      cashback({ payoutTxHash: 'DEDUCTED_FROM_DEBT' }),
    ]);
    expect(isCashbackPayoutActivity(activity({ hash: undefined }), debtOnly)).toBe(false);
  });

  it('matches nothing while the cashbacks are still loading', () => {
    expect(isCashbackPayoutActivity(activity(), new Set())).toBe(false);
  });

  it('matches a payout the backend named, with no cashback list at all', () => {
    // While the list loads, or for a cardholder whose card has closed and so never fetches it.
    const named = activity({
      title: 'Cashback on UBER',
      metadata: {
        transferContext: {
          kind: TransferContextKind.CARD_CASHBACK,
          cardTransactionId: 'card-tx-1',
        },
      },
    });

    expect(isCashbackPayoutActivity(named, new Set())).toBe(true);
  });

  it('leaves a transfer the backend named as something else alone', () => {
    const refund = activity({
      hash: '0xdeadbeef',
      metadata: { transferContext: { kind: TransferContextKind.CARD_REFUND } },
    });

    expect(isCashbackPayoutActivity(refund, hashes)).toBe(false);
  });
});

describe('getCashbackPurchaseId', () => {
  it('takes the purchase from the backend label', () => {
    const named = activity({
      hash: '0xdeadbeef',
      metadata: {
        transferContext: {
          kind: TransferContextKind.CARD_CASHBACK,
          cardTransactionId: 'card-tx-9',
        },
      },
    });

    expect(getCashbackPurchaseId(named, undefined)).toBe('card-tx-9');
  });

  it('finds the purchase through the cashback row the payout hash belongs to', () => {
    expect(getCashbackPurchaseId(activity({ hash: '0xABC123' }), [cashback()])).toBe('card-tx-1');
  });

  it('has no purchase for a transfer that is not a payout', () => {
    expect(getCashbackPurchaseId(activity({ hash: '0xdeadbeef' }), [cashback()])).toBeUndefined();
    expect(getCashbackPurchaseId(activity({ hash: undefined }), [cashback()])).toBeUndefined();
  });

  it('never matches a row settled against debt', () => {
    const debt = cashback({ payoutTxHash: 'DEDUCTED_FROM_DEBT' });

    expect(getCashbackPurchaseId(activity({ hash: 'DEDUCTED_FROM_DEBT' }), [debt])).toBeUndefined();
  });
});

describe('a day of payouts', () => {
  it('drops every payout row and keeps the rest of the feed', () => {
    // Rain and Wirex cashback are the same records paid by the same wallet, so
    // two payouts on one day are dropped by the one rule either way.
    const hashes = collectCashbackPayoutHashes([
      cashback({ _id: 'cb-1', payoutTxHash: '0xaaa' }),
      cashback({ _id: 'cb-2', payoutTxHash: '0xBBB' }),
    ]);

    const feed = [
      activity({ clientTxId: 'a', hash: '0xaaa' }),
      activity({ clientTxId: 'b', hash: '0xbbb' }),
      activity({ clientTxId: 'c', hash: '0xccc', title: 'Receive USDC' }),
    ];

    expect(
      feed.filter(item => !isCashbackPayoutActivity(item, hashes)).map(item => item.clientTxId),
    ).toEqual(['c']);
  });
});
