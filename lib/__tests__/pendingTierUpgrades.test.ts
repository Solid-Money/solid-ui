import {
  PENDING_TIER_UPGRADE_TTL_MS,
  REJECTED_TIER_UPGRADE_HOLD_MS,
  settlePendingTierUpgrades,
  upgradeRejectionMessage,
} from '@/lib/pendingTierUpgrades';
import { RewardsTier } from '@/lib/types';
import { usePendingTierUpgradeStore } from '@/store/usePendingTierUpgradeStore';

const mockGetReceipt = jest.fn();
jest.mock('@/lib/pimlico', () => ({
  pimlicoClient: () => ({ getUserOperationReceipt: (args: unknown) => mockGetReceipt(args) }),
}));
const mockUpgrade = jest.fn();
jest.mock('@/lib/api', () => ({
  upgradeTierSubscription: (body: unknown) => mockUpgrade(body),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});

const HASH = '0x9418d2b5cd787c8accc4fa1d2a0844f0808c0945a1c8885dd33c9e4d8ce1a1f1';
const TX = '0x616c8066046af09a5054d4eb060eb8e30a9c8b30e0892399daa175da3aadaeab';
const NOW = 1_800_000_000_000;
const STATE = { enabled: true };

const notFound = () =>
  Object.assign(new Error('not found'), { name: 'UserOperationReceiptNotFoundError' });

/** A thrown `fetch` response, the way the API client throws a non-2xx. */
const httpError = (status: number, message?: string) =>
  new Response(JSON.stringify(message ? { statusCode: status, message } : {}), { status });

const remember = (
  overrides: { submittedAt?: number; transactionHash?: string; rejectedAt?: number } = {},
) =>
  usePendingTierUpgradeStore.getState().remember({
    userOpHash: HASH,
    userId: 'user-1',
    submittedAt: NOW - 60_000,
    tier: RewardsTier.ULTRA,
    ...overrides,
  });

const stored = () => Object.values(usePendingTierUpgradeStore.getState().upgrades);

beforeEach(() => {
  usePendingTierUpgradeStore.setState({ upgrades: {} });
  mockGetReceipt.mockReset();
  mockUpgrade.mockReset().mockResolvedValue(STATE);
});

it('has nothing to settle for an account with no earlier upgrade', async () => {
  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
  expect(mockGetReceipt).not.toHaveBeenCalled();
});

it('leaves another account’s upgrade alone', async () => {
  remember();

  await expect(settlePendingTierUpgrades('user-2', NOW)).resolves.toEqual({ status: 'none' });
  expect(stored()).toHaveLength(1);
});

/** The payment landed; the membership is started from it rather than a second one. */
it('confirms an earlier payment that landed, and forgets it', async () => {
  remember();
  mockGetReceipt.mockResolvedValue({ success: true, receipt: { transactionHash: TX } });

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
    status: 'confirmed',
    state: STATE,
  });
  expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
  expect(stored()).toEqual([]);
});

it('does not look the receipt up again once the payment is known to have landed', async () => {
  remember({ transactionHash: TX });

  await settlePendingTierUpgrades('user-1', NOW);

  expect(mockGetReceipt).not.toHaveBeenCalled();
  expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
});

it('stays pending, with the landing remembered, while the confirm keeps failing', async () => {
  remember();
  mockGetReceipt.mockResolvedValue({ success: true, receipt: { transactionHash: TX } });
  mockUpgrade.mockRejectedValue(new Error('502'));

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
  expect(stored()).toEqual([expect.objectContaining({ transactionHash: TX })]);
});

/** A reverted batch moved no money, so a new upgrade may go ahead. */
it('drops an upgrade that reverted', async () => {
  remember();
  mockGetReceipt.mockResolvedValue({ success: false, receipt: { transactionHash: TX } });

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
  expect(mockUpgrade).not.toHaveBeenCalled();
  expect(stored()).toEqual([]);
});

it('stays pending while the bundler has not seen it yet', async () => {
  remember();
  mockGetReceipt.mockRejectedValue(notFound());

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
  expect(stored()).toHaveLength(1);
});

it('gives up on one the bundler never saw, once it is past the TTL', async () => {
  remember({ submittedAt: NOW - PENDING_TIER_UPGRADE_TTL_MS - 1 });
  mockGetReceipt.mockRejectedValue(notFound());

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
  expect(stored()).toEqual([]);
});

/** An unreachable bundler says nothing about whether the payment landed. */
it('stays pending when the lookup itself fails, however old', async () => {
  remember({ submittedAt: NOW - PENDING_TIER_UPGRADE_TTL_MS - 1 });
  mockGetReceipt.mockRejectedValue(new Error('network'));

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
  expect(stored()).toHaveLength(1);
});

/**
 * A 4xx after the money landed is the backend's final answer — support has
 * been alerted to refund or fix it. The user is told why, and the record is
 * kept so a second press cannot pay again before support has acted.
 */
it('reports a payment the backend refused for good, and holds it', async () => {
  remember({ transactionHash: TX });
  mockUpgrade.mockRejectedValue(
    httpError(400, 'Your payment of $799.00 is below the Ultra price of $999.00.'),
  );

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
    status: 'rejected',
    message: 'Your payment of $799.00 is below the Ultra price of $999.00.',
  });
  expect(stored()).toEqual([expect.objectContaining({ rejectedAt: NOW })]);
});

it('keeps a payment the backend says has not landed yet as pending', async () => {
  remember({ transactionHash: TX });
  mockUpgrade.mockRejectedValue(httpError(503, 'Your payment has not landed yet.'));

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
  expect(stored()).toEqual([expect.not.objectContaining({ rejectedAt: expect.anything() })]);
});

it('lets a refused payment go a day after it was refused', async () => {
  remember({ transactionHash: TX, rejectedAt: NOW - REJECTED_TIER_UPGRADE_HOLD_MS - 1 });

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
  expect(mockUpgrade).not.toHaveBeenCalled();
  expect(stored()).toEqual([]);
});

describe('upgradeRejectionMessage', () => {
  it('reads the backend message off a final 4xx', async () => {
    await expect(
      upgradeRejectionMessage(httpError(409, 'You already have this membership.')),
    ).resolves.toBe('You already have this membership.');
  });

  it('falls back to plain wording when the body says nothing', async () => {
    await expect(upgradeRejectionMessage(httpError(400))).resolves.toMatch(/no need to pay again/);
  });

  it('treats 5xx, 401, 429 and network errors as not final', async () => {
    for (const error of [httpError(503), httpError(401), httpError(429), new Error('network')]) {
      await expect(upgradeRejectionMessage(error)).resolves.toBeNull();
    }
  });
});
