import {
  PENDING_TIER_UPGRADE_MAX_HOLD_MS,
  PENDING_TIER_UPGRADE_TTL_MS,
  REJECTED_TIER_UPGRADE_HOLD_MS,
  settlePendingTierUpgrades,
  upgradeRejectionMessage,
} from '@/lib/pendingTierUpgrades';
import { RewardsTier } from '@/lib/types';
import { usePendingTierUpgradeStore } from '@/store/usePendingTierUpgradeStore';

const mockGetReceipt = jest.fn();
const mockGetStatus = jest.fn();
jest.mock('@/lib/pimlico', () => ({
  pimlicoClient: () => ({
    getUserOperationReceipt: (args: unknown) => mockGetReceipt(args),
    getUserOperationStatus: (args: unknown) => mockGetStatus(args),
  }),
}));
const mockGetNonce = jest.fn();
jest.mock('permissionless/actions', () => ({
  getAccountNonce: (_client: unknown, args: unknown) => mockGetNonce(args),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: () => ({}) }));
const mockUpgrade = jest.fn();
jest.mock('@/lib/api', () => ({
  upgradeTierSubscription: (body: unknown) => mockUpgrade(body),
}));
const mockWithRefreshToken = jest.fn();
jest.mock('@/lib/utils', () => ({
  withRefreshToken: (call: () => Promise<unknown>) => mockWithRefreshToken(call),
}));
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
  overrides: {
    submittedAt?: number;
    transactionHash?: string;
    rejectedAt?: number;
    sender?: string;
    nonce?: string;
  } = {},
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
  mockGetStatus.mockReset();
  mockGetNonce.mockReset();
  mockUpgrade.mockReset().mockResolvedValue(STATE);
  mockWithRefreshToken.mockReset().mockImplementation((call: () => Promise<unknown>) => call());
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

/** A record from before the nonce was kept goes on the TTL alone, as it always did. */
it('gives up on an older record with no nonce once it is past the TTL', async () => {
  remember({ submittedAt: NOW - PENDING_TIER_UPGRADE_TTL_MS - 1 });
  mockGetReceipt.mockRejectedValue(notFound());

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
  expect(stored()).toEqual([]);
  expect(mockGetNonce).not.toHaveBeenCalled();
});

/**
 * The operation has no expiry of ours, so being past the TTL with no receipt
 * says nothing about whether it can still land. The Safe's nonce does.
 */
describe('an upgrade with no receipt, sent with a known nonce', () => {
  const SAFE = '0x1111111111111111111111111111111111111111';
  const PAST_TTL = NOW - PENDING_TIER_UPGRADE_TTL_MS - 1;
  const sentAt = (submittedAt: number) => remember({ submittedAt, sender: SAFE, nonce: '7' });

  beforeEach(() => {
    mockGetReceipt.mockRejectedValue(notFound());
  });

  it('is waited on inside the TTL, without asking anything else', async () => {
    sentAt(NOW - 60_000);

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
    expect(mockGetNonce).not.toHaveBeenCalled();
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  /** Nothing sent with nonce 7 can be included once the Safe is at 8. */
  it('is let go once the Safe’s nonce has moved past it', async () => {
    sentAt(PAST_TTL);
    mockGetNonce.mockResolvedValue(8n);

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
    expect(mockGetNonce).toHaveBeenCalledWith(expect.objectContaining({ address: SAFE }));
    expect(mockGetStatus).not.toHaveBeenCalled();
    expect(stored()).toEqual([]);
  });

  /** Nonce 7 unused: the signed operation can still land, and pay. */
  it('is kept past the TTL while the nonce is unused and the bundler still has it', async () => {
    sentAt(PAST_TTL);
    mockGetNonce.mockResolvedValue(7n);

    for (const status of ['not_submitted', 'submitted', 'included', 'queued']) {
      mockGetStatus.mockResolvedValue({ status, transactionHash: null });
      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
    }
    expect(mockGetStatus).toHaveBeenCalledWith({ hash: HASH });
    expect(stored()).toHaveLength(1);
  });

  it('is let go once the bundler says it no longer has it', async () => {
    mockGetNonce.mockResolvedValue(7n);

    for (const status of ['not_found', 'rejected', 'failed']) {
      sentAt(PAST_TTL);
      mockGetStatus.mockResolvedValue({ status, transactionHash: null });
      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(stored()).toEqual([]);
    }
  });

  it('stays pending when the nonce or the status cannot be read', async () => {
    sentAt(PAST_TTL);
    mockGetNonce.mockRejectedValueOnce(new Error('rpc'));

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });

    mockGetNonce.mockResolvedValue(7n);
    mockGetStatus.mockRejectedValue(new Error('bundler'));

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
    expect(stored()).toHaveLength(1);
  });

  /**
   * The bound: a bundler that keeps saying "queued", or cannot be asked, holds
   * the user up for a day at most. A new payment then takes the same unused
   * nonce, so the two can never both land.
   */
  it('is let go a day after it was sent, whatever the bundler says', async () => {
    sentAt(NOW - PENDING_TIER_UPGRADE_MAX_HOLD_MS - 1);
    mockGetNonce.mockRejectedValue(new Error('rpc'));
    mockGetStatus.mockResolvedValue({ status: 'submitted', transactionHash: null });

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
    expect(stored()).toEqual([]);
  });

  /** A receipt that turns up is still what decides, whatever the nonce. */
  it('confirms it once a receipt turns up', async () => {
    sentAt(PAST_TTL);
    mockGetReceipt.mockResolvedValue({ success: true, receipt: { transactionHash: TX } });

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
      status: 'confirmed',
      state: STATE,
    });
    expect(mockGetNonce).not.toHaveBeenCalled();
  });
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

/**
 * A 401 on the upgrade call sends `withRefreshToken` to refresh the session,
 * and a refresh that fails throws its own error — a 404 when the backend has
 * no refresh token. That is about the session, not the payment: it must never
 * be read as the backend refusing the upgrade.
 */
it('keeps the payment pending when only the session refresh failed', async () => {
  remember({ transactionHash: TX });
  mockUpgrade.mockRejectedValue(httpError(401));
  mockWithRefreshToken.mockImplementation(async (call: () => Promise<unknown>) => {
    await call().catch(() => undefined);
    throw httpError(404, 'Refresh token not found');
  });

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
  expect(stored()).toEqual([expect.not.objectContaining({ rejectedAt: expect.anything() })]);
});

it('still reads a refusal from the upgrade call retried after a refresh', async () => {
  remember({ transactionHash: TX });
  mockUpgrade
    .mockRejectedValueOnce(httpError(401))
    .mockRejectedValueOnce(httpError(409, 'You already have this membership.'));
  mockWithRefreshToken.mockImplementation(async (call: () => Promise<unknown>) => {
    await call().catch(() => undefined);
    return call();
  });

  await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
    status: 'rejected',
    message: 'You already have this membership.',
  });
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
