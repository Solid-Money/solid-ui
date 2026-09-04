import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RewardsUpgradeFeedback from '@/components/Rewards/RewardsUpgradeFeedback';
import { useRewardsUserData } from '@/hooks/useRewards';
import { fetchRewardsUserData } from '@/lib/api';
import { RewardsTier, RewardsUserData } from '@/lib/types';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/store/useUserStore', () => {
  // Jest factories resolve mocks before ES imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return { useUserStore: create(() => ({ users: [{ userId: 'a', selected: true }] })) };
});
jest.mock('@/lib/api', () => ({ fetchRewardsUserData: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: any) => fn() }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: 'Dialog',
  DialogContent: 'DialogContent',
  DialogTitle: 'DialogTitle',
}));
jest.mock('@/constants/rewards', () => ({ getTierDisplayName: (tier: string) => tier }));

const data = (tier: RewardsTier) =>
  ({ currentTier: tier, cashbackRate: 2, maxCashbackMonthly: 100 }) as RewardsUserData;
const fetchData = fetchRewardsUserData as jest.Mock;
let client: QueryClient;
let root: ReturnType<typeof create>;
let query: ReturnType<typeof useRewardsUserData>;
function Harness() {
  const result = useRewardsUserData();
  useEffect(() => {
    query = result;
  });
  return null;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  useUserStore.setState({ users: [{ userId: 'a', selected: true } as any] });
  useRewardsUpgradeStore.setState({
    userId: 'a',
    session: 0,
    confirmed: undefined,
    success: undefined,
    pendingUntil: undefined,
    timedOut: false,
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root?.unmount());
  client.clear();
  jest.useRealTimers();
});
async function mount(feedback = false) {
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        {feedback ? <RewardsUpgradeFeedback /> : <Harness />}
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
}
it('rejects late account-A data and establishes B without an upgrade popup', async () => {
  let resolveA!: (data: RewardsUserData) => void;
  fetchData.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveA = resolve;
      }),
  );
  await mount();
  fetchData.mockResolvedValue(data(RewardsTier.ULTRA));
  await act(async () => {
    useUserStore.setState({ users: [{ userId: 'b', selected: true } as any] });
  });
  await act(async () => {
    resolveA(data(RewardsTier.PRIME));
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(client.getQueryData(['rewards', 'userData', 'a'])).toBeUndefined();
  expect(client.getQueryData(['rewards', 'userData', 'b'])).toMatchObject({
    currentTier: RewardsTier.ULTRA,
  });
  expect(useRewardsUpgradeStore.getState().success).toBeUndefined();
});
it('does not turn request failure into Core or a successful upgrade', async () => {
  fetchData.mockResolvedValue(data(RewardsTier.PRIME));
  await mount();
  fetchData.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await query.refetch();
    await jest.advanceTimersByTimeAsync(1);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10);
  });
  expect(client.getQueryState(['rewards', 'userData', 'a'])?.status).toBe('error');
  expect(useRewardsUpgradeStore.getState().confirmed?.currentTier).toBe(RewardsTier.PRIME);
  expect(useRewardsUpgradeStore.getState().success).toBeUndefined();
});
it('polls past 60 seconds and celebrates once after the actual API promotion', async () => {
  fetchData.mockResolvedValue(data(RewardsTier.CORE));
  await mount(true);
  await act(async () => {
    useRewardsUpgradeStore.getState().savingsChanged('a');
  });
  for (let i = 0; i < 12; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
  expect(useRewardsUpgradeStore.getState().pendingUntil).toBeDefined();
  expect(useRewardsUpgradeStore.getState().success).toBeUndefined();
  fetchData.mockResolvedValue(data(RewardsTier.PRIME));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(useRewardsUpgradeStore.getState().success?.currentTier).toBe(RewardsTier.PRIME);
  expect(useRewardsUpgradeStore.getState().pendingUntil).toBeUndefined();
  const calls = fetchData.mock.calls.length;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(15000);
  });
  expect(fetchData).toHaveBeenCalledTimes(calls);
});
it('ends reconciliation after 90 seconds without submitting anything again', async () => {
  fetchData.mockResolvedValue(data(RewardsTier.CORE));
  await mount(true);
  await act(async () => {
    useRewardsUpgradeStore.getState().savingsChanged('a');
  });
  for (let i = 0; i < 18; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
  expect(useRewardsUpgradeStore.getState().timedOut).toBe(true);
  expect(useRewardsUpgradeStore.getState().success).toBeUndefined();
  const calls = fetchData.mock.calls.length;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(fetchData).toHaveBeenCalledTimes(calls);
});

it('refetches when switching back to a recently cached account', async () => {
  fetchData.mockResolvedValue(data(RewardsTier.CORE));
  await mount();
  await act(async () => {
    useUserStore.setState({ users: [{ userId: 'b', selected: true } as any] });
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  fetchData.mockResolvedValue(data(RewardsTier.PRIME));
  await act(async () => {
    useUserStore.setState({ users: [{ userId: 'a', selected: true } as any] });
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(fetchData.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(useRewardsUpgradeStore.getState().confirmed?.currentTier).toBe(RewardsTier.PRIME);
  expect(useRewardsUpgradeStore.getState().success).toBeUndefined();
});
