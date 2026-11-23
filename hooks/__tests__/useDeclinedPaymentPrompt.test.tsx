import React from 'react';

import { DeclinedPaymentPrompt, useDeclinedPaymentPrompt } from '@/hooks/useDeclinedPaymentPrompt';
import { useDeclineSpendable } from '@/hooks/useDeclineSpendable';
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
let mockSpendableLoading: boolean;
const mockRefetchSpendable = jest.fn();
jest.mock('@/hooks/useCardSpendable', () => ({
  useCardSpendable: () => ({
    data: mockSpendable,
    isLoading: mockSpendableLoading,
    refetch: mockRefetchSpendable,
  }),
}));
let mockBalancesRefresh: any;
const mockRefetchBalances = jest.fn();
jest.mock('@/hooks/useBalances', () => ({
  useBalancesRefresh: (options: any) => {
    mockBalancesRefresh = options;
    return { refetch: mockRefetchBalances };
  },
}));
let mockTile: { availableUsd: number | null; isLoading: boolean };
jest.mock('@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures', () => ({
  useSpendModeFigures: () => mockTile,
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
  const currentPrompt = useDeclinedPaymentPrompt(true);
  React.useEffect(() => {
    prompt = currentPrompt;
  }, [currentPrompt]);
  return null;
};

describe('useDeclinedPaymentPrompt', () => {
  let root: any;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    mockSpendable = { available: { amount: '0', currency: 'usd' } };
    mockSpendableLoading = false;
    mockRefetchSpendable.mockReset();
    mockRefetchBalances.mockReset();
    mockRegistration = { registration: {}, mode: 'cash', isRegistered: true };
    mockBaseCredit = { base: {}, readsBase: false, isBaseGateReady: true };
    mockDisplayCurrency = { inEuros: false };
    // The tile cannot say unless a test gives it a number: the hook's own figures stand.
    mockTile = { availableUsd: null, isLoading: false };
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
    mockRegistration.isLoading = true;
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

  it('keeps the cash prompt when the registration read fails', () => {
    mockTransactions = { pages: [{ data: [declined(new Date(NOW.getTime() - HOUR_MS))] }] };
    mockRegistration = { registration: null, mode: 'cash', isLoading: false };

    act(() => {
      root = create(<Probe />);
    });

    expect(prompt?.available).toEqual({ amount: 0, currency: 'USD' });
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
      mockTile = { availableUsd: 12.5, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt?.available).toEqual({ amount: 12.5, currency: 'USD' });
    });

    it('is what the banner quotes in Credit mode, in the main currency', () => {
      // On its own the hook would say the larger single line, $11. The tile reads $43.40.
      mockRegistration = {
        ...mockRegistration,
        mode: 'credit',
        position: { availableToBorrowUsd: 11_000_000n },
      };
      mockBaseCredit = {
        ...mockBaseCredit,
        readsBase: true,
        base: { data: { availableToBorrowUsd: 5_000_000n } },
      };
      mockDisplayCurrency = { inEuros: true, usdPerEur: 1.1657 };
      mockTransactions = {
        pages: [{ data: [{ ...declined(new Date(NOW.getTime() - HOUR_MS)), amount: '110.96' }] }],
      };
      mockTile = { availableUsd: 43.4, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });
      expect(prompt?.available).toEqual({ amount: 37.23, currency: 'EUR' });

      mockTile = { availableUsd: 111, isLoading: false };
      act(() => root.update(<Probe />));
      expect(prompt).toBeNull();
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

    it('still quotes the tile, in dollars, when the backend cash read failed', () => {
      mockSpendable = undefined;
      mockTile = { availableUsd: 12.5, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt?.available).toEqual({ amount: 12.5, currency: 'USD' });
    });

    it('waits for the backend cash read while it is still loading', () => {
      mockSpendable = undefined;
      mockSpendableLoading = true;
      mockTile = { availableUsd: 12.5, isLoading: false };

      act(() => {
        root = create(<Probe />);
      });

      expect(prompt).toBeNull();
    });

    it("re-reads the tile's balances with the receipt's poll and its refresh", async () => {
      let refetchCash: (() => Promise<unknown>) | undefined;
      const Receipt = () => {
        const { refetchCash: current } = useDeclineSpendable({ refetchInterval: 15_000 });
        React.useEffect(() => {
          refetchCash = current;
        }, [current]);
        return null;
      };

      act(() => {
        root = create(<Receipt />);
      });
      expect(mockBalancesRefresh).toEqual({ enabled: true, refetchInterval: 15_000 });

      await refetchCash?.();
      expect(mockRefetchSpendable).toHaveBeenCalledTimes(1);
      expect(mockRefetchBalances).toHaveBeenCalledTimes(1);
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
