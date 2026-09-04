import { REWARDS_RECONCILIATION_MS } from '@/lib/rewardsUpgrade';
import { RewardsTier, RewardsUserData } from '@/lib/types';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

jest.mock('@/store/useUserStore', () => {
  // Jest factories resolve mocks before ES imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return { useUserStore: create(() => ({ users: [{ userId: 'a', selected: true }] })) };
});

const data = (tier: RewardsTier) =>
  ({ currentTier: tier, cashbackRate: 2, maxCashbackMonthly: 100 }) as RewardsUserData;
const store = useRewardsUpgradeStore;
const observe = (tier: RewardsTier) =>
  store.getState().observe('a', store.getState().session, data(tier));

beforeEach(() => {
  jest.useFakeTimers();
  store.setState({
    userId: 'a',
    session: 0,
    confirmed: undefined,
    success: undefined,
    pendingUntil: undefined,
    timedOut: false,
  });
});
afterEach(() => jest.useRealTimers());

it('initial load does not celebrate; an actual later promotion does exactly once', () => {
  observe(RewardsTier.PRIME);
  expect(store.getState().success).toBeUndefined();
  observe(RewardsTier.ULTRA);
  expect(store.getState().success?.currentTier).toBe(RewardsTier.ULTRA);
  store.getState().dismiss();
  observe(RewardsTier.ULTRA);
  expect(store.getState().success).toBeUndefined();
});
it('keeps the backend tier while waiting past its 60-second cache and resolves only on promotion', () => {
  observe(RewardsTier.CORE);
  store.getState().savingsChanged('a');
  const deadline = store.getState().pendingUntil;
  jest.advanceTimersByTime(65_000);
  observe(RewardsTier.CORE);
  store.getState().savingsChanged('a');
  expect(store.getState().pendingUntil).toBe(deadline);
  expect(store.getState().confirmed?.currentTier).toBe(RewardsTier.CORE);
  expect(store.getState().success).toBeUndefined();
  observe(RewardsTier.PRIME);
  expect(store.getState().pendingUntil).toBeUndefined();
  expect(store.getState().success?.currentTier).toBe(RewardsTier.PRIME);
});
it('times out without inventing a tier, and a later fresh promotion may confirm it', () => {
  observe(RewardsTier.CORE);
  store.getState().savingsChanged('a');
  expect(store.getState().pendingUntil).toBe(Date.now() + REWARDS_RECONCILIATION_MS);
  store.getState().finishWaiting();
  expect(store.getState().success).toBeUndefined();
  expect(store.getState().timedOut).toBe(true);
  observe(RewardsTier.PRIME);
  expect(store.getState().timedOut).toBe(false);
});
it('ignores old account responses, including switch-away-and-back races', () => {
  observe(RewardsTier.CORE);
  store.getState().savingsChanged('a');
  store.getState().selectAccount('b');
  store.getState().observe('a', 0, data(RewardsTier.ULTRA));
  store.getState().savingsChanged('a');
  expect(store.getState().success).toBeUndefined();
  expect(store.getState().pendingUntil).toBeUndefined();
  store.getState().observe('b', 1, data(RewardsTier.ULTRA));
  expect(store.getState().success).toBeUndefined();
  store.getState().selectAccount('a');
  store.getState().observe('a', 0, data(RewardsTier.ULTRA));
  expect(store.getState().confirmed).toBeUndefined();
});
it('clears the old popup and baseline synchronously when selection changes', () => {
  observe(RewardsTier.CORE);
  observe(RewardsTier.PRIME);
  useUserStore.setState({ users: [{ userId: 'b', selected: true } as any] });
  expect(store.getState().userId).toBe('b');
  expect(store.getState().confirmed).toBeUndefined();
  expect(store.getState().success).toBeUndefined();
});
it('does not celebrate a downgrade', () => {
  observe(RewardsTier.ULTRA);
  observe(RewardsTier.PRIME);
  expect(store.getState().success).toBeUndefined();
});

it('polls an ambiguous balance event quietly without blocking a wallet-funded upgrade', () => {
  store.setState({ savingsConfirmed: false });
  store.getState().savingsChanged('a', false);
  expect(store.getState().pendingUntil).toBeDefined();
  expect(store.getState().savingsConfirmed).toBe(false);
  store.getState().finishWaiting();
  expect(store.getState().timedOut).toBe(false);
});
