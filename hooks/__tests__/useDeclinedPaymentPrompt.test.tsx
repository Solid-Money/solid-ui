import React from 'react';

import { DeclinedPaymentPrompt, useDeclinedPaymentPrompt } from '@/hooks/useDeclinedPaymentPrompt';
import { CardTransactionCategory } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');

let mockTransactions: any;
let mockSpendable: any;
let mockRegistration: any;
let mockBaseCredit: any;
let mockDisplayCurrency: any;
jest.mock('@/hooks/useCardTransactions', () => ({
  useCardTransactions: () => ({ data: mockTransactions }),
}));
jest.mock('@/hooks/useCardSpendable', () => ({
  useCardSpendable: () => ({ data: mockSpendable }),
}));
jest.mock('@/hooks/useCardSpendRegistration', () => ({
  useCardSpendRegistration: () => mockRegistration,
}));
jest.mock('@/hooks/useCardCreditPositions', () => ({
  useCardCreditPositions: () => mockBaseCredit,
}));
jest.mock('@/hooks/useMainCurrency', () => ({
  useCardDisplayCurrency: () => mockDisplayCurrency,
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
    mockRegistration = { registration: {}, mode: 'cash', isRegistered: true };
    mockBaseCredit = { base: {}, readsBase: false, isBaseGateReady: true };
    mockDisplayCurrency = { inEuros: false };
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

  it('shows credit in the main currency and clears the banner when credit covers the payment', () => {
    mockTransactions = {
      pages: [
        {
          data: [
            {
              ...declined(new Date(NOW.getTime() - HOUR_MS)),
              amount: '364.90',
              currency: 'ILS',
              usd_amount: '110.96',
            },
          ],
        },
      ],
    };
    mockRegistration = {
      ...mockRegistration,
      mode: 'credit',
      position: { availableToBorrowUsd: 11_000_000n },
    };
    mockBaseCredit = {
      ...mockBaseCredit,
      readsBase: true,
      base: { data: { availableToBorrowUsd: 32_400_000n } },
    };
    mockDisplayCurrency = { inEuros: true, usdPerEur: 1.1657 };

    act(() => {
      root = create(<Probe />);
    });
    expect(prompt?.available).toEqual({ amount: 27.79, currency: 'EUR' });

    // Together the two credit balances exceed the payment, but neither instance can pay it.
    mockRegistration.position = { availableToBorrowUsd: 79_000_000n };
    act(() => root.update(<Probe />));
    expect(prompt?.available).toEqual({ amount: 67.77, currency: 'EUR' });

    mockBaseCredit.base = { data: { availableToBorrowUsd: 111_000_000n } };
    act(() => root.update(<Probe />));
    expect(prompt).toBeNull();
  });

  it('waits for the active mode and for enabled Base credit before showing a balance', () => {
    mockTransactions = { pages: [{ data: [declined(new Date(NOW.getTime() - HOUR_MS))] }] };
    mockRegistration.registration = null;
    act(() => {
      root = create(<Probe />);
    });
    expect(prompt).toBeNull();

    mockRegistration = {
      registration: {},
      mode: 'credit',
      isRegistered: true,
      position: { availableToBorrowUsd: 10_000_000n },
    };
    mockBaseCredit.readsBase = true;
    act(() => root.update(<Probe />));
    expect(prompt).toBeNull();
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
});
