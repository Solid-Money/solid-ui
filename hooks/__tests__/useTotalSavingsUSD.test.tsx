import React from 'react';

import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { VaultType } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');
let mockBalances: any[];
let mockRates: any[];
let mockPrice: any;
let mockBalanceIndex = 0;
let mockRateIndex = 0;
let model: ReturnType<typeof useTotalSavingsUSD>;
let root: any;
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { safeAddress: '0xabc' } }),
}));
jest.mock('@/hooks/useVault', () => ({
  useVaultBalance: () => mockBalances[mockBalanceIndex++ % 3],
}));
jest.mock('@/hooks/useVaultExchangeRate', () => ({
  useVaultExchangeRate: () => mockRates[mockRateIndex++ % 3],
}));
jest.mock('@/hooks/useNativePriceUsd', () => ({ useNativePriceQuery: () => mockPrice }));
function Probe() {
  const value = useTotalSavingsUSD();
  React.useEffect(() => {
    model = value;
  }, [value]);
  return null;
}
const success = (data: number) => ({ data, isLoading: false, isError: false });
beforeEach(() => {
  mockBalanceIndex = 0;
  mockRateIndex = 0;
  mockBalances = [success(10), success(0), success(0)];
  mockRates = [success(1.2), success(1.1), success(1.1)];
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
  mockRates[0] = { data: undefined, isLoading: false, isError: true };
  act(() => root.update(<Probe />));
  // Savings and Earn render this; undefined would hold them on a skeleton forever.
  expect(model.data).toBe(10);
  expect(model.exactValuesByVault?.[VaultType.USDC]).toBeUndefined();
  expect(model.isError).toBe(true);
});
it('marks only the failed vault unavailable in the exact values', () => {
  mockBalances[1] = { data: undefined, isLoading: false, isError: true };
  act(() => root.update(<Probe />));
  expect(model.exactValuesByVault?.[VaultType.FUSE]).toBeUndefined();
  expect(model.exactValuesByVault?.[VaultType.USDC]).toBe(12);
  expect(model.data).toBe(12);
  expect(model.isError).toBe(true);
});
it('leaves funded native shares unpriced in the exact values when the price fails', () => {
  mockBalances[1] = success(20);
  mockPrice = { data: undefined, isLoading: false, isError: true };
  act(() => root.update(<Probe />));
  expect(model.exactValuesByVault?.[VaultType.FUSE]).toBeUndefined();
  expect(model.data).toBe(12);
  expect(model.isError).toBe(true);
});
it('does not need a price or rate to value a confirmed empty vault', () => {
  mockRates[1] = { data: undefined, isLoading: false, isError: true };
  mockPrice = { data: undefined, isLoading: false, isError: true };
  act(() => root.update(<Probe />));
  expect(model.data).toBe(12);
  expect(model.exactValuesByVault?.[VaultType.FUSE]).toBe(0);
  expect(model.isError).toBe(false);
});
