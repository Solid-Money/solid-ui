/// <reference types="jest" />
import { Cashback, CashbackStatus } from '@/lib/types';
import {
  getNewlyReceivedCashbackIds,
  getReceivedSoUsdCashbackIds,
  isReceivedSoUsdCashback,
} from '@/lib/utils/storeReview';

/**
 * Factory for minimal Cashback fixtures. Defaults to a valid *received* soUSD
 * payout; override fields to exercise the other branches.
 */
function makeCashback(overrides: Partial<Cashback> & { _id: string }): Cashback {
  return {
    transactionId: `tx-${overrides._id}`,
    status: CashbackStatus.Paid,
    soUsdAmount: '1.5',
    soUsdRate: '1',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isReceivedSoUsdCashback', () => {
  it('is true for a Paid cashback with a positive soUSD amount', () => {
    expect(isReceivedSoUsdCashback(makeCashback({ _id: '1', soUsdAmount: '2.5' }))).toBe(true);
  });

  it('is false while the cashback is still pending or escrowed', () => {
    expect(
      isReceivedSoUsdCashback(makeCashback({ _id: '1', status: CashbackStatus.Pending })),
    ).toBe(false);
    expect(
      isReceivedSoUsdCashback(makeCashback({ _id: '2', status: CashbackStatus.Escrowed })),
    ).toBe(false);
  });

  it('is false for non-received terminal states', () => {
    expect(
      isReceivedSoUsdCashback(makeCashback({ _id: '1', status: CashbackStatus.FullyRefunded })),
    ).toBe(false);
    expect(isReceivedSoUsdCashback(makeCashback({ _id: '2', status: CashbackStatus.Failed }))).toBe(
      false,
    );
  });

  it('is false when there is no soUSD amount or it is zero', () => {
    expect(isReceivedSoUsdCashback(makeCashback({ _id: '1', soUsdAmount: undefined }))).toBe(false);
    expect(isReceivedSoUsdCashback(makeCashback({ _id: '2', soUsdAmount: '0' }))).toBe(false);
  });

  it('excludes legacy FUSE-only payouts (no soUSD amount)', () => {
    const legacy = makeCashback({
      _id: '1',
      soUsdAmount: undefined,
      fuseAmount: '10',
      fuseUsdPrice: '0.05',
    });
    expect(isReceivedSoUsdCashback(legacy)).toBe(false);
  });
});

describe('getReceivedSoUsdCashbackIds', () => {
  it('returns ids for only the received soUSD payouts', () => {
    const cashbacks = [
      makeCashback({ _id: 'paid-1' }),
      makeCashback({ _id: 'pending-1', status: CashbackStatus.Pending }),
      makeCashback({ _id: 'paid-2', soUsdAmount: '0.75' }),
      makeCashback({ _id: 'legacy-1', soUsdAmount: undefined, fuseAmount: '5' }),
    ];

    expect(getReceivedSoUsdCashbackIds(cashbacks)).toEqual(['paid-1', 'paid-2']);
  });

  it('returns an empty array when nothing has been received', () => {
    expect(getReceivedSoUsdCashbackIds([])).toEqual([]);
  });
});

describe('getNewlyReceivedCashbackIds', () => {
  it('returns only received ids not already known', () => {
    expect(getNewlyReceivedCashbackIds(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c']);
  });

  it('returns an empty array when everything is already known', () => {
    expect(getNewlyReceivedCashbackIds(['a', 'b'], ['a', 'b', 'c'])).toEqual([]);
  });

  it('accepts a Set of known ids', () => {
    expect(getNewlyReceivedCashbackIds(['a', 'b'], new Set(['b']))).toEqual(['a']);
  });
});
