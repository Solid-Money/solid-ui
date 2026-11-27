import React from 'react';

import {
  type SpendModeFigures,
  useSpendModeFigures,
} from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

const { act, create } = jest.requireActual('react-test-renderer');

const usd = (dollars: number) => BigInt(Math.round(dollars * 1_000_000));

let mockRegistration: any;
let mockCash: any;
let mockBaseLive: boolean;
let mockBaseCredit: any;
let mockBaseMode: any;
jest.mock('@/hooks/useCardSpendRegistration', () => ({
  useCardSpendRegistration: () => mockRegistration,
}));
jest.mock('@/hooks/useCardSpendableBalance', () => ({
  __esModule: true,
  default: () => mockCash,
}));
jest.mock('@/hooks/useCardCreditPositions', () => ({
  useBaseCreditInstance: () => ({ isLive: mockBaseLive, isLoading: false }),
  useCardCreditPositions: () => ({ base: mockBaseCredit }),
  useBaseSpendMode: () => mockBaseMode,
}));
jest.mock('@/hooks/useMainCurrency', () => ({
  useCardDisplayCurrency: () => ({
    formatMicroUsd: (micro: bigint) => `$${(Number(micro) / 1_000_000).toFixed(2)}`,
  }),
}));

let figures: SpendModeFigures;
const Probe = () => {
  const current = useSpendModeFigures();
  React.useEffect(() => {
    figures = current;
  }, [current]);
  return null;
};
const read = () => {
  let root: any;
  act(() => {
    root = create(<Probe />);
  });
  act(() => root.unmount());
  return figures;
};

const fuseCredit = (headroom: number) => ({
  debtUsd: 0n,
  borrowingPowerUsd: 0n,
  prospectivePowerUsd: usd(headroom),
  creditHeadroomUsd: usd(headroom),
  healthFactorWad: 0n,
  fullyPriced: true,
});
const baseCredit = (headroom: number) => ({
  data: { creditHeadroomUsd: usd(headroom) },
  isPending: false,
  fetchStatus: 'idle',
  isError: false,
});
const baseModeIs = (mode: string | null) => ({ mode, isLoading: false, isError: false });

beforeEach(() => {
  mockRegistration = {
    mode: 'cash',
    canChangeMode: true,
    pendingMode: null,
    position: fuseCredit(0),
    borrowApyPerSecond: 0n,
    isLoading: false,
  };
  mockCash = { data: 0, baseUsd: 0, isLoading: false };
  mockBaseLive = true;
  mockBaseCredit = baseCredit(0);
  mockBaseMode = baseModeIs('cash');
});

describe('useSpendModeFigures: what one payment can use', () => {
  test('Credit shows the bigger credit line, not the total', () => {
    mockRegistration = { ...mockRegistration, mode: 'credit', position: fuseCredit(26.52) };
    mockBaseCredit = baseCredit(10.02);
    mockBaseMode = baseModeIs('credit');

    const { availableUsd, availableToSpend, segmentValue } = read();
    expect(availableUsd).toBeCloseTo(26.52);
    expect(availableToSpend).toBe('$26.52');
    // The picker still names the whole line.
    expect(segmentValue.credit).toBe('$36.54');
  });

  test('Cash shows the bigger side, not the total', () => {
    mockCash = { data: 36.54, baseUsd: 10.02, isLoading: false };

    const { availableUsd, availableToSpend, cashBalance } = read();
    expect(availableUsd).toBeCloseTo(26.52);
    expect(availableToSpend).toBe('$26.52');
    expect(cashBalance).toBe('$36.54');
  });

  test('a side left on Cash by an unfinished switch counts its cash, not its credit line', () => {
    mockRegistration = { ...mockRegistration, mode: 'credit', position: fuseCredit(15) };
    mockCash = { data: 208, baseUsd: 8, isLoading: false };
    mockBaseCredit = baseCredit(60);
    mockBaseMode = baseModeIs('cash');

    expect(read().availableToSpend).toBe('$15.00');

    mockCash = { data: 240, baseUsd: 40, isLoading: false };
    expect(read().availableToSpend).toBe('$40.00');
  });

  test('a Base balance with no Base mode to read counts as cash', () => {
    mockBaseLive = false;
    mockBaseMode = baseModeIs(null);
    mockCash = { data: 30, baseUsd: 20, isLoading: false };

    expect(read().availableToSpend).toBe('$20.00');
  });

  test('waits for the Base mode before showing a figure', () => {
    mockBaseMode = { mode: null, isLoading: true, isError: false };

    const { isLoading, availableUsd } = read();
    expect(isLoading).toBe(true);
    expect(availableUsd).toBeNull();
  });

  test('takes an unreadable Base mode to match the card', () => {
    mockRegistration = { ...mockRegistration, mode: 'credit', position: fuseCredit(15) };
    mockBaseCredit = baseCredit(60);
    mockBaseMode = { mode: null, isLoading: false, isError: true };

    expect(read().availableToSpend).toBe('$60.00');
  });

  test('reads "—" in Credit when the Base credit line cannot be read', () => {
    mockRegistration = { ...mockRegistration, mode: 'credit', position: fuseCredit(15) };
    mockBaseCredit = { data: undefined, isPending: false, fetchStatus: 'idle', isError: true };
    mockBaseMode = baseModeIs('credit');

    const { availableUsd, availableToSpend } = read();
    expect(availableUsd).toBeNull();
    expect(availableToSpend).toBe('—');
  });
});
