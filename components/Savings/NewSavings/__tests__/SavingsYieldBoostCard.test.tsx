import React from 'react';

import SavingsYieldBoostCard from '@/components/Savings/NewSavings/SavingsYieldBoostCard';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/skeleton', () => ({ __esModule: true, default: 'Skeleton' }));
jest.mock('@/lib/config', () => ({ isDevFeatureEnabled: false }));
jest.mock('@/lib/merklYieldBoost', () => ({ YIELD_BOOST_REWARD_DECIMALS: 18 }));
// The real module pulls in wagmi, which Jest can't parse; these mirror it.
jest.mock('@/lib/utils', () => {
  const formatNumber = (value: number, max = 6, min = 2) =>
    new Intl.NumberFormat('en-us', {
      maximumFractionDigits: max,
      minimumFractionDigits: Math.min(value >= 1 ? min : 0, max),
    }).format(value);
  return {
    formatNumber,
    formatBalanceUSD: (value: number) => (value > 0 ? `$${formatNumber(value, 2)}` : '$0.00'),
  };
});
jest.mock('@/hooks/useNativePriceUsd', () => ({ useNativePriceUsd: () => 0.02 }));
jest.mock('@/hooks/useRewards', () => ({
  useRewardsUserData: () => ({ data: mockRewardsData }),
}));
jest.mock('@/hooks/useYieldBoostRewards', () => ({
  useYieldBoostRewards: () => mockBoostQuery,
  useClaimYieldBoost: () => ({ mutateAsync: mockClaim, isPending: false }),
}));

let mockRewardsData: Record<string, number> = {};
let mockBoostQuery: { data?: Record<string, unknown>; isLoading: boolean } = { isLoading: false };
const mockClaim = jest.fn();

const ONE_FUSE = 10n ** 18n;

let root: any;
const render = () => {
  act(() => {
    root = create(<SavingsYieldBoostCard />);
  });
  return root;
};
const texts = () =>
  root.root
    .findAllByType('Text')
    .map((node: any) => [node.props.children].flat().join(''))
    .join('|');
// NativeWind wraps Pressable, so find the claim by what a screen reader sees.
const claimButton = () =>
  root.root.findAll(
    (node: any) =>
      node.props.accessibilityLabel === 'Claim yield boost' &&
      typeof node.props.onPress === 'function',
  )[0];

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockRewardsData = { yieldBoostPercentage: 2 };
  mockBoostQuery = {
    isLoading: false,
    data: { claimable: 5n * ONE_FUSE, earned: 21_032n * ONE_FUSE, priceUsd: null },
  };
});
afterEach(() => act(() => root?.unmount()));

it('shows the tier boost and what the boost has earned in USD', () => {
  render();

  expect(texts()).toContain('+2% Boost');
  // 21,032 FUSE × $0.02
  expect(texts()).toContain('$420.64');
});

it('claims through the mutation when there is something to claim', async () => {
  mockClaim.mockResolvedValue({ amount: '5' });
  render();

  expect(claimButton().props.disabled).toBe(false);
  await act(async () => claimButton().props.onPress());
  expect(mockClaim).toHaveBeenCalledTimes(1);
});

it('disables the claim when nothing is claimable yet', () => {
  mockBoostQuery = { isLoading: false, data: { claimable: 0n, earned: 0n, priceUsd: null } };
  render();

  expect(claimButton().props.disabled).toBe(true);
});

it('renders nothing for a user with no boost and nothing to claim', () => {
  mockRewardsData = { yieldBoostPercentage: 0 };
  mockBoostQuery = { isLoading: false, data: { claimable: 0n, earned: 0n, priceUsd: null } };
  render();

  expect(root.toJSON()).toBeNull();
});

it('still lets a user who lost the boost collect what they earned', () => {
  mockRewardsData = { yieldBoostPercentage: 0 };
  render();

  expect(texts()).not.toContain('% Boost');
  expect(claimButton().props.disabled).toBe(false);
});
