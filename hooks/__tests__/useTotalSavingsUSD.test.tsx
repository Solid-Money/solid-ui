import React from 'react';

import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { VaultType } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');
type Query = { data: number | undefined; isLoading: boolean; isError: boolean };
// Keyed by vault name (USDC / FUSE / ETH / EUR), so the order the hook reads
// the vaults in does not matter.
let mockBalances: Record<string, Query>;
let mockRates: Record<string, Query>;
let mockPrice: any;
let model: ReturnType<typeof useTotalSavingsUSD>;
let root: any;
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { safeAddress: '0xabc' } }),
}));
jest.mock('@/hooks/useVault', () => ({
  useVaultBalance: (_address: string, vault: { name: string }) => mockBalances[vault.name],
}));
jest.mock('@/hooks/useVaultExchangeRate', () => ({
  useVaultExchangeRate: (name: string) => mockRates[name],
}));
jest.mock('@/hooks/useNativePriceUsd', () => ({ useNativePriceQuery: () => mockPrice }));
function Probe() {
  const value = useTotalSavingsUSD();
  React.useEffect(() => {
    model = value;
  }, [value]);
  return null;
}
const success = (data: number): Query => ({ data, isLoading: false, isError: false });
const loading: Query = { data: undefined, isLoading: true, isError: false };
const failed: Query = { data: undefined, isLoading: false, isError: true };
beforeEach(() => {
  mockBalances = { USDC: success(10), FUSE: success(0), ETH: success(0), EUR: success(0) };
  mockRates = {
    USDC: success(1.2),
    FUSE: success(1.1),
    ETH: success(1.1),
    EUR: success(1),
  };
  mockPrice = success(2);
  act(() => {
    root = create(<Probe />);
  });
});
afterEach(() => {
  act(() => root.unmount());
});
it('values actual redeemable shares rather than assuming one share is one dollar', () => {
  expect(model.data).toBe(12);
  expect(model.valuesByVault?.[VaultType.USDC]).toBe(12);
});
it('keeps the lenient total other screens rely on when a funded rate is unavailable', () => {
  mockRates.USDC = failed;
  act(() => root.update(<Probe />));
  // Savings and Earn render this; undefined would hold them on a skeleton forever.
  expect(model.data).toBe(10);
  expect(model.exactValuesByVault?.[VaultType.USDC]).toBeUndefined();
  expect(model.isError).toBe(true);
});
it('marks only the failed vault unavailable in the exact values', () => {
  mockBalances.FUSE = failed;
  act(() => root.update(<Probe />));
  expect(model.exactValuesByVault?.[VaultType.FUSE]).toBeUndefined();
  expect(model.exactValuesByVault?.[VaultType.USDC]).toBe(12);
  expect(model.data).toBe(12);
  expect(model.isError).toBe(true);
});
it('leaves funded native shares unpriced in the exact values when the price fails', () => {
  mockBalances.FUSE = success(20);
  mockPrice = failed;
  act(() => root.update(<Probe />));
  expect(model.exactValuesByVault?.[VaultType.FUSE]).toBeUndefined();
  expect(model.data).toBe(12);
  expect(model.isError).toBe(true);
});
it('does not need a price or rate to value a confirmed empty vault', () => {
  mockRates.FUSE = failed;
  mockPrice = failed;
  act(() => root.update(<Probe />));
  expect(model.data).toBe(12);
  expect(model.exactValuesByVault?.[VaultType.FUSE]).toBe(0);
  expect(model.isError).toBe(false);
});

describe('the EUR vault (soEURC)', () => {
  it('is reported in euros on its own and never added to the USD total', () => {
    mockBalances.EUR = success(500);
    mockRates.EUR = success(1.02);
    act(() => root.update(<Probe />));

    expect(model.eurValue).toBeCloseTo(510);
    // The USD figures are exactly what they were without it.
    expect(model.data).toBe(12);
    expect(model.valuesByVault).not.toHaveProperty(VaultType.EUR);
    expect(model.exactValuesByVault).not.toHaveProperty(VaultType.EUR);
  });

  it('never holds the USD totals on a slow or failed Base read', () => {
    mockBalances.EUR = loading;
    act(() => root.update(<Probe />));
    expect(model.isLoading).toBe(false);
    expect(model.data).toBe(12);
    expect(model.isEurLoading).toBe(true);
    expect(model.eurValue).toBeUndefined();

    mockBalances.EUR = failed;
    act(() => root.update(<Probe />));
    expect(model.isError).toBe(false);
    expect(model.isEurError).toBe(true);
  });

  it('reads a missing soEURC rate as par, like the other vaults', () => {
    mockBalances.EUR = success(40);
    mockRates.EUR = failed;
    act(() => root.update(<Probe />));
    expect(model.eurValue).toBe(40);
    expect(model.isEurError).toBe(true);
  });
});
