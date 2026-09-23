import React from 'react';

import BuyFuseScreen from '@/components/Swap/BuyFuseScreen';
import { RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@cryptoalgebra/fuse-sdk', () => ({
  ADDRESS_ZERO: '0x0000000000000000000000000000000000000000',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/assets/images/messages', () => 'MessageCircle');
jest.mock('@/components/Max', () => 'Max');
jest.mock('@/components/RenderTokenIcon', () => 'RenderTokenIcon');
jest.mock('@/components/Swap/BuyFuseSavingsReview', () => 'BuyFuseSavingsReview');
jest.mock('@/components/Swap/BuyFuseTierCard', () => 'BuyFuseTierCard');
jest.mock('@/components/Swap/BuyFuseUpgradeReview', () => 'BuyFuseUpgradeReview');
jest.mock('@/components/Swap/SwapButton', () => 'SwapButton');
jest.mock('@/components/Swap/SwapParams', () => 'SwapParams');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/constants/tokens', () => ({ STABLECOINS_TOKENS: { USDC: { address: '0x1234' } } }));
jest.mock('@/constants/vaults', () => ({ VAULTS: [{ name: 'FUSE', minimumAmount: '5000' }] }));
jest.mock('@/hooks/useRewards', () => ({
  useRewardsUserData: (options: unknown) => mockUseRewardsUserData(options),
}));
jest.mock('@/hooks/useUSDCValue', () => ({ useUSDCValue: () => ({ formatted: 0 }) }));
jest.mock('@/lib/buyFuseFunding', () => ({ formatBuyFuseFundingBalance: () => '0' }));
jest.mock('@/lib/buyFuseTiers', () => ({
  getBuyFuseProgress: jest.fn(),
  getBuyFuseTierForAmount: jest.fn(),
  getBuyFuseTierTargets: jest.fn(() => []),
  getNextBuyFuseTier: jest.fn(),
  hasReachedFuseTarget: jest.fn(),
}));
jest.mock('@/lib/getTokenIcon', () => ({
  __esModule: true,
  default: () => ({ type: 'image', source: 'fuse' }),
}));
jest.mock('@/lib/utils', () => ({ formatUSD: () => '$0' }));
jest.mock('@/store/swapStore', () => ({
  useSwapState: (selector: (state: any) => unknown) => selector(mockSwapState),
  useSwapActionHandlers: () => ({ onUserInput: jest.fn() }),
  useDerivedSwapInfo: () => ({
    currencyBalances: { INPUT: undefined },
    parsedAmount: undefined,
    toggledTrade: undefined,
    voltageTrade: { trade: undefined },
    isVoltageTrade: false,
    isVoltageTradeLoading: false,
    tradeState: { state: 'NO_ROUTE_FOUND' },
  }),
}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  useRewardsUpgradeStore: (selector: (state: any) => unknown) =>
    selector({ confirmed: undefined, pendingUntil: undefined, savingsConfirmed: false }),
}));
jest.mock('@/store/useSupportDrawerStore', () => ({ openSupportDrawer: jest.fn() }));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: (state: any) => unknown) =>
    selector({ users: [{ selected: true, userId: 'test-user' }] }),
}));

const mockUseRewardsUserData = jest.fn((_options?: unknown) => ({
  data: undefined,
  isError: false,
}));
const mockSwapState = {
  independentField: 'OUTPUT',
  typedValue: '',
  actions: {
    selectCurrency: jest.fn(),
    typeInput: jest.fn(),
    resetForm: jest.fn(),
    setModal: jest.fn(),
  },
};

it('shows the upgrade purchase without legacy tier loading or Savings instructions', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let root: any;
  act(() => {
    root = create(
      <BuyFuseScreen
        requestedTier={RewardsTier.ULTRA}
        upgradeContext={{ tier: RewardsTier.ULTRA, depositToSavings: false }}
      />,
    );
  });

  expect(mockUseRewardsUserData).toHaveBeenCalledWith({ enabled: false });
  expect(root.root.findAllByType('BuyFuseTierCard')).toHaveLength(0);
  expect(root.root.findByType('SwapButton').props.disabled).toBe(false);
  expect(JSON.stringify(root.toJSON())).not.toContain('Checking available tier upgrades');
  expect(JSON.stringify(root.toJSON())).not.toContain('Savings minimum deposit');

  act(() => root.root.findByType('SwapButton').props.onConfirmed());
  expect(root.root.findAllByType('BuyFuseUpgradeReview')).toHaveLength(1);
  act(() => root.unmount());
});

it('keeps the legacy tier guidance for non-upgrade Buy FUSE entry points', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockUseRewardsUserData.mockClear();
  let root: any;
  act(() => {
    root = create(<BuyFuseScreen />);
  });

  expect(mockUseRewardsUserData).toHaveBeenCalledWith({ enabled: true });
  expect(JSON.stringify(root.toJSON())).toContain('Checking available tier upgrades');
  expect(JSON.stringify(root.toJSON())).toContain('Savings minimum deposit');
  expect(root.root.findByType('SwapButton').props.disabled).toBe(true);
  act(() => root.unmount());
});

it('shows the Savings minimum only when the upgrade needs soFUSE', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let root: any;
  act(() => {
    root = create(
      <BuyFuseScreen
        requestedTier={RewardsTier.PRIME}
        upgradeContext={{ tier: RewardsTier.PRIME, depositToSavings: true }}
      />,
    );
  });

  expect(JSON.stringify(root.toJSON())).toContain('Savings minimum deposit');
  expect(JSON.stringify(root.toJSON())).not.toContain('Checking available tier upgrades');
  act(() => root.unmount());
});
