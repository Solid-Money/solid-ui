import React from 'react';

import EarnYieldBoostCard from '@/components/Earn/EarnYieldBoostCard';
import { YieldBoostClaimStatus } from '@/lib/types';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/skeleton', () => ({ __esModule: true, default: 'Skeleton' }));
// A non-production build, where the rewards screen previews locked perks at
// stock rates. This card must not.
jest.mock('@/lib/config', () => ({ isDevFeatureEnabled: true }));
// The real module pulls in wagmi, which Jest can't parse; these mirror it.
jest.mock('@/lib/utils', () => {
  const formatNumber = (value: number, max = 6, min = 2) =>
    new Intl.NumberFormat('en-us', {
      maximumFractionDigits: max,
      minimumFractionDigits: Math.min(value >= 1 ? min : 0, max),
    }).format(value);
  return {
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
    formatNumber,
    formatBalanceUSD: (value: number) => (value > 0 ? `$${formatNumber(value, 2)}` : '$0.00'),
  };
});
jest.mock('@/hooks/useRewards', () => ({
  useYieldBoostSummary: () => mockSummaryQuery,
  useClaimYieldBoost: () => ({ mutateAsync: mockClaim, isPending: false }),
}));

const Toast = jest.requireMock('react-native-toast-message').default as { show: jest.Mock };

let mockSummaryQuery: { data?: Record<string, unknown>; isLoading: boolean } = {
  isLoading: false,
};
const mockClaim = jest.fn();

const summary = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  claimsEnabled: true,
  tier: 'prime',
  apyPercentage: 2,
  maxDepositUsd: 10_000,
  claimableSoFuse: '51.25',
  claimableUsd: 1.64,
  totalEarnedSoFuse: '420.5',
  totalEarnedUsd: 13.46,
  totalClaimedSoFuse: '369.25',
  lastAccrual: null,
  pendingClaim: null,
  maxClaimUsd: 250,
  ...overrides,
});

let root: any;
const render = () => {
  act(() => {
    root = create(<EarnYieldBoostCard />);
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
  mockSummaryQuery = { isLoading: false, data: summary() };
});
afterEach(() => act(() => root?.unmount()));

it('shows the tier boost and everything it has earned', () => {
  render();

  expect(texts()).toContain('+2% Boost');
  expect(texts()).toContain('$13.46');
});

it('claims, and says what was paid', async () => {
  mockClaim.mockResolvedValue({
    claim: { status: YieldBoostClaimStatus.PAID, soFuseAmount: '51.25' },
    summary: summary(),
  });
  render();

  expect(claimButton().props.disabled).toBe(false);
  await act(async () => claimButton().props.onPress());

  expect(mockClaim).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'success',
      text1: 'Yield boost claimed',
      text2: '51.25 soFUSE',
    }),
  );
});

it('says a claim that is still being sent is on its way', async () => {
  mockClaim.mockResolvedValue({
    claim: { status: YieldBoostClaimStatus.SUBMITTED, soFuseAmount: '51.25' },
    summary: summary(),
  });
  render();

  await act(async () => claimButton().props.onPress());

  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ text1: 'Yield boost on its way' }),
  );
});

it('shows the reason the backend gave when a claim is refused', async () => {
  mockClaim.mockRejectedValue(new Error("You've reached today's limit."));
  render();

  await act(async () => claimButton().props.onPress());

  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'error',
      text2: "You've reached today's limit.",
    }),
  );
});

it('disables the claim when nothing is claimable yet', () => {
  mockSummaryQuery = { isLoading: false, data: summary({ claimableSoFuse: '0.0' }) };
  render();

  expect(claimButton().props.disabled).toBe(true);
});

it('disables the claim while an earlier one is still being paid', () => {
  mockSummaryQuery = {
    isLoading: false,
    data: summary({ pendingClaim: { id: 'c1', status: YieldBoostClaimStatus.SUBMITTED } }),
  };
  render();

  expect(claimButton().props.disabled).toBe(true);
  expect(claimButton().props.accessibilityState).toEqual({ disabled: true, busy: true });
});

it('explains a paused claim instead of offering it', () => {
  mockSummaryQuery = { isLoading: false, data: summary({ claimsEnabled: false }) };
  render();

  expect(claimButton().props.disabled).toBe(true);
  expect(texts()).toContain('Claims are paused for now');
});

it('never previews a boost for a Core user, even off production', () => {
  mockSummaryQuery = {
    isLoading: false,
    data: summary({ tier: 'core', apyPercentage: 0, claimableSoFuse: '0.0', totalEarnedUsd: 0 }),
  };
  render();

  expect(root.toJSON()).toBeNull();
});

it('renders nothing for a user with no boost and nothing to claim', () => {
  mockSummaryQuery = {
    isLoading: false,
    data: summary({ apyPercentage: 0, claimableSoFuse: '0.0' }),
  };
  render();

  expect(root.toJSON()).toBeNull();
});

it('still lets a user who lost the boost collect what they earned', () => {
  mockSummaryQuery = { isLoading: false, data: summary({ apyPercentage: 0 }) };
  render();

  expect(texts()).not.toContain('% Boost');
  expect(claimButton().props.disabled).toBe(false);
});
