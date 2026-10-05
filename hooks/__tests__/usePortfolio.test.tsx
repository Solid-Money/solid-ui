import React from 'react';

import { cashToken } from '@/components/Assets/__tests__/fixtures';
import { usePortfolio } from '@/hooks/usePortfolio';
import { ADDRESSES } from '@/lib/config';
import { CardProvider, VaultType } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');
const mockCustodyHook = jest.fn();
let mockUser: any;
let mockWallet: any;
let mockSavings: any;
let mockCustody: any;
let mockRegistration: any;
let mockCard: any;
let mockCardStatus: any;
let mockProvider: string;
let mockPriceError: boolean;
let model: ReturnType<typeof usePortfolio>;
let root: any;
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: mockUser }) }));
jest.mock('@/hooks/useWalletTokens', () => ({ useWalletTokens: () => mockWallet }));
jest.mock('@/hooks/useTotalSavingsUSD', () => ({ useTotalSavingsUSD: () => mockSavings }));
let mockMembership: any;
jest.mock('@/hooks/useTierMembership', () => ({ useTierMembership: () => mockMembership }));
jest.mock('@/hooks/useCardSpendRegistration', () => ({
  useCardSpendRegistration: () => mockRegistration,
}));
jest.mock('@/lib/config', () => {
  const actual = jest.requireActual('@/lib/config');
  return {
    ...actual,
    ADDRESSES: {
      ...actual.ADDRESSES,
      fuse: {
        ...actual.ADDRESSES.fuse,
        cashModuleV2: '0x3333333333333333333333333333333333333333',
        retiredCashModulesV2: ['0x5555555555555555555555555555555555555555'],
      },
    },
  };
});
jest.mock('@/hooks/usePortfolioCustody', () => ({
  usePortfolioCustody: (args: any) => {
    mockCustodyHook(args);
    return mockCustody;
  },
}));
jest.mock('@/hooks/useCardStatus', () => ({ useCardStatus: () => mockCardStatus }));
jest.mock('@/hooks/useCardDetails', () => ({ useCardDetails: () => mockCard }));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/hooks/useNativePriceUsd', () => ({
  useNativePriceQuery: (chain: number) => ({
    data: chain === 122 ? '0.012' : '4000',
    isLoading: false,
    isError: mockPriceError,
  }),
}));
jest.mock('@/hooks/useAnalytics', () => ({
  useMaxAPY: () => ({ maxAPY: 4.5, isAPYsLoading: false }),
}));
jest.mock('@/lib/utils', () => ({ hasCard: (status: any) => !!status?.active }));
jest.mock('@/lib/refreshAccountQueries', () => ({ refreshAccountQueries: jest.fn() }));
function Probe() {
  const value = usePortfolio();
  React.useEffect(() => {
    model = value;
  }, [value]);
  return null;
}

beforeEach(() => {
  mockUser = { userId: 'account-a', safeAddress: '0xAAAA' };
  mockMembership = {
    data: { lock: { lockAddress: 'pinned-lock', nextUnlockAt: null } },
    isLoading: false,
    isError: false,
  };
  mockProvider = CardProvider.WIREX;
  mockPriceError = false;
  mockRegistration = {
    position: {},
    registration: { moduleAddress: 'credit-module' },
    isLoading: false,
  };
  mockCardStatus = { data: { active: true }, isLoading: false, isError: false };
  mockCard = {
    data: { balances: { available: { amount: '9999' } } },
    isLoading: false,
    isError: false,
  };
  mockWallet = {
    tokens: [
      cashToken('USDC', '180', 1),
      cashToken('ETH', '0.0091', 4000),
      cashToken('FUSE', '1000', 0.012, 122),
    ],
    error: null,
    failedChainIds: [],
    isLoading: false,
  };
  mockSavings = {
    valuesByVault: { [VaultType.USDC]: 2000, [VaultType.FUSE]: 0, [VaultType.ETH]: 310 },
    exactValuesByVault: { [VaultType.USDC]: 2000, [VaultType.FUSE]: 0, [VaultType.ETH]: 310 },
    isLoading: false,
    isError: false,
  };
  mockCustody = {
    locked: { data: 10000, isLoading: false, isError: false },
    credit: {
      data: {
        debtUsd: 350,
        collateral: [
          { ...cashToken('soUSD', '560', 1, 122), contractAddress: ADDRESSES.fuse.vault },
        ],
      },
      isLoading: false,
      isError: false,
    },
  };
  act(() => {
    root = create(<Probe />);
  });
});
afterEach(() => {
  act(() => root.unmount());
  jest.clearAllMocks();
});

it('reconciles wallet, yield, tier lock and escrow once, excluding Wirex spending power', () => {
  expect(model.earnTotal).toBeCloseTo(2870);
  expect(model.cashTotal).toBeCloseTo(228.4);
  expect(model.lockedTotal).toBe(120);
  expect(model.totalAssets).toBeCloseTo(3218.4);
  expect(model.netBalance).toBeCloseTo(2868.4);
  expect(model.hasCardBalance).toBe(false);
});
it('includes a separately funded Rain card even before activation', () => {
  mockProvider = CardProvider.RAIN;
  mockCardStatus = { ...mockCardStatus, data: { active: false } };
  mockCard.data.balances.available.amount = '100';
  act(() => root.update(<Probe />));
  expect(model.hasCardBalance).toBe(true);
  expect(model.totalAssets).toBeCloseTo(3318.4);
});
it('waits for an inactive Rain card balance, then shows the rest flagged incomplete', () => {
  mockProvider = CardProvider.RAIN;
  mockCardStatus = { ...mockCardStatus, data: { active: false } };
  mockCard = { data: undefined, isLoading: true, isError: false };
  act(() => root.update(<Probe />));
  expect(model.isLoading).toBe(true);
  mockCard = { data: undefined, isLoading: false, isError: true };
  act(() => root.update(<Probe />));
  expect(model.totalAssets).toBeCloseTo(3218.4);
  expect(model.isComplete).toBe(false);
  expect(model.isError).toBe(true);
});
it('keeps the loaded networks when one network fails, flagged incomplete', () => {
  mockWallet = { ...mockWallet, failedChainIds: [56] };
  act(() => root.update(<Probe />));
  expect(model.cashTotal).toBeCloseTo(228.4);
  expect(model.totalAssets).toBeCloseTo(3218.4);
  expect(model.isComplete).toBe(false);
  expect(model.isError).toBe(true);
});
it('does not let one unpriced token blank the balance', () => {
  mockWallet = {
    ...mockWallet,
    tokens: [
      ...mockWallet.tokens,
      { ...cashToken('AIRDROP', '5000', 0), contractAddress: '0x9'.padEnd(42, '9') },
    ],
  };
  act(() => root.update(<Probe />));
  expect(model.cashTotal).toBeCloseTo(228.4);
  expect(model.unpricedCashCount).toBe(1);
  expect(model.netBalance).toBeCloseTo(2868.4);
  expect(model.isError).toBe(true);
});
it('reports failed custody reads as missing, not zero, and keeps everything else', () => {
  mockCustody = {
    locked: { data: undefined, isLoading: false, isError: true },
    credit: { data: undefined, isLoading: false, isError: true },
  };
  act(() => root.update(<Probe />));
  expect(model.lockedTotal).toBeUndefined();
  expect(model.debt).toBeUndefined();
  expect(model.earnTotal).toBeCloseTo(2310);
  expect(model.totalAssets).toBeCloseTo(2538.4);
  expect(model.isComplete).toBe(false);
  expect(model.isError).toBe(true);
});
it('still reads credit custody when the tier-membership API fails', () => {
  mockMembership = { data: undefined, isLoading: false, isError: true };
  act(() => root.update(<Probe />));
  expect(mockCustodyHook).toHaveBeenLastCalledWith(
    expect.objectContaining({ lockAddress: undefined, creditModules: expect.any(Array) }),
  );
  expect(model.debt).toBe(350);
  expect(model.isError).toBe(true);
});
it('flags stale locked FUSE prices when the price refresh fails', () => {
  mockPriceError = true;
  act(() => root.update(<Probe />));
  expect(model.isError).toBe(true);
});
it('keeps custody independent of a failed registration read and includes retired credit modules', () => {
  mockRegistration = {
    position: null,
    registration: null,
    isLoading: false,
    readError: new Error('Registration unavailable'),
  };
  act(() => root.update(<Probe />));
  expect(mockCustodyHook).toHaveBeenLastCalledWith(
    expect.objectContaining({
      creditModules: [ADDRESSES.fuse.cashModuleV2, ...ADDRESSES.fuse.retiredCashModulesV2],
    }),
  );
  expect(model.totalAssets).toBeCloseTo(3218.4);
  expect(model.debt).toBe(350);
  expect(model.isError).toBe(true);
});
it('reads custody for the selected account and the membership pinned lock contract', () => {
  expect(mockCustodyHook).toHaveBeenLastCalledWith(
    expect.objectContaining({
      userId: 'account-a',
      safeAddress: '0xAAAA',
      lockAddress: 'pinned-lock',
    }),
  );
  mockUser = { userId: 'account-b', safeAddress: '0xBBBB' };
  mockCustody = {
    locked: { data: undefined, isLoading: true },
    credit: { data: undefined, isLoading: true },
  };
  act(() => root.update(<Probe />));
  expect(mockCustodyHook).toHaveBeenLastCalledWith(
    expect.objectContaining({ userId: 'account-b', safeAddress: '0xBBBB' }),
  );
  expect(model.isLoading).toBe(true);
});
