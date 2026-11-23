import React from 'react';

import { DeclinedPaymentPrompt, useDeclinedPaymentPrompt } from '@/hooks/useDeclinedPaymentPrompt';
import { CardTransactionCategory } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');

let mockTransactions: any;
let mockSpendable: any;
jest.mock('@/hooks/useCardTransactions', () => ({
  useCardTransactions: () => ({ data: mockTransactions }),
}));
jest.mock('@/hooks/useCardSpendable', () => ({
  useCardSpendable: () => ({ data: mockSpendable }),
}));
let mockTile: { availableUsd: number | null; isLoading: boolean };
jest.mock('@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures', () => ({
  useSpendModeFigures: () => mockTile,
}));
jest.mock('@/hooks/useMainCurrency', () => ({
  useCardDisplayCurrency: () => ({ inEuros: false, toDisplayAmount: (usd: number) => usd }),
}));
jest.mock('@/store/useHomePromptStore', () => ({
  useHomePromptStore: (select: (state: any) => any) => select({ dismissedDeclines: {} }),
}));

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-10-18T10:00:00.000Z');

const declined = (at: Date) => ({
  id: 'tx-declined',
  category: CardTransactionCategory.PURCHASE,
  status: 'declined',
  amount: '18.75',
  currency: 'USD',
  merchant_name: 'Corner Market',
  declined_reason: 'Insufficient funds',
  authorized_at: at.toISOString(),
  posted_at: at.toISOString(),
});

let prompt: DeclinedPaymentPrompt | null;
const Probe = () => {
  prompt = useDeclinedPaymentPrompt(true);
  return null;
};

describe('useDeclinedPaymentPrompt', () => {
  let root: any;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    mockSpendable = { available: { amount: '0', currency: 'usd' } };
    mockTile = { availableUsd: 0, isLoading: false };
  });

  afterEach(() => {
    act(() => root?.unmount());
    jest.useRealTimers();
  });

  it('offers an uncovered decline from the last day', () => {
    mockTransactions = { pages: [{ data: [declined(new Date(NOW.getTime() - 2 * HOUR_MS))] }] };

    act(() => {
      root = create(<Probe />);
    });

    expect(prompt).toMatchObject({ transactionId: 'tx-declined', merchantName: 'Corner Market' });
  });

  it('lets the banner go when its day is up, though Home stayed mounted and nothing refetched', () => {
    // 23 hours old: on show now, and out of its window an hour from now.
    mockTransactions = { pages: [{ data: [declined(new Date(NOW.getTime() - 23 * HOUR_MS))] }] };

    act(() => {
      root = create(<Probe />);
    });
    expect(prompt).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(HOUR_MS + 2_000);
    });

    expect(prompt).toBeNull();
  });

  describe("the Available to spend tile's number (T-174)", () => {
    beforeEach(() => {
      mockTransactions = { pages: [{ data: [declined(new Date(NOW.getTime() - 2 * HOUR_MS))] }] };
      // Cash only, as the backend counts it.
      mockSpendable = { available: { amount: '5', currency: 'usd' } };
    });

    it('is what the banner quotes, not the cash-only figure', () => {
      // Credit mode: the tile counts the credit line.
      mockTile = { availableUsd: 12.5, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt?.available).toEqual({ amount: 12.5, currency: 'USD' });
    });

    it('hides the banner once it covers the payment', () => {
      mockTile = { availableUsd: 20, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt).toBeNull();
    });

    it('waits for the tile rather than show one number and then another', () => {
      mockTile = { availableUsd: null, isLoading: true };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt).toBeNull();
    });

    it('falls back to the cash figure when the tile cannot say', () => {
      mockTile = { availableUsd: null, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt?.available).toEqual({ amount: 5, currency: 'USD' });
    });
  });
});
