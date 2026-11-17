import React from 'react';

import {
  PENDING_TIER_UPGRADE_MAX_HOLD_MS,
  PENDING_TIER_UPGRADE_TTL_MS,
  REJECTED_TIER_UPGRADE_HOLD_MS,
  settlePendingTierUpgrades,
  upgradeRejectionMessage,
} from '@/lib/pendingTierUpgrades';
import { RewardsTier } from '@/lib/types';
import {
  type PendingTierUpgrade,
  useHasPendingTierUpgrade,
  usePendingTierUpgradeStore,
} from '@/store/usePendingTierUpgradeStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

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
const mockGetEvents = jest.fn();
jest.mock('@/lib/wagmi', () => ({
  publicClient: () => ({ getContractEvents: (args: unknown) => mockGetEvents(args) }),
}));
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

const remember = (overrides: Partial<PendingTierUpgrade> = {}) =>
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
  mockGetEvents.mockReset().mockResolvedValue([]);
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
  const BLOCK = '45000000';
  const PAST_TTL = NOW - PENDING_TIER_UPGRADE_TTL_MS - 1;
  const sentAt = (submittedAt: number, overrides: Partial<PendingTierUpgrade> = {}) =>
    remember({ submittedAt, sender: SAFE, nonce: '7', block: BLOCK, ...overrides });

  /** The EntryPoint's `UserOperationEvent` for an operation it included. */
  const included = (userOpHash: string, success: boolean, transactionHash: string = TX) => ({
    args: { userOpHash, success },
    transactionHash,
  });

  beforeEach(() => {
    mockGetReceipt.mockRejectedValue(notFound());
  });

  it('is waited on inside the TTL, without asking anything else', async () => {
    sentAt(NOW - 60_000);

    await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'pending' });
    expect(mockGetNonce).not.toHaveBeenCalled();
    expect(mockGetStatus).not.toHaveBeenCalled();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  /**
   * Nonce 8 says only that nonce 7 is used — not by what. The chain, asked
   * after the nonce was read, says whether it was this upgrade.
   */
  describe('once the Safe’s nonce has moved past it', () => {
    beforeEach(() => mockGetNonce.mockResolvedValue(8n));

    it('is let go once the chain shows it was never included', async () => {
      sentAt(PAST_TTL);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockGetNonce).toHaveBeenCalledWith(expect.objectContaining({ address: SAFE }));
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'UserOperationEvent',
          args: { userOpHash: [HASH] },
          fromBlock: 45_000_000n,
          toBlock: 'latest',
        }),
      );
      expect(mockGetStatus).not.toHaveBeenCalled();
      expect(stored()).toEqual([]);
    });

    /**
     * The receipt lookup found nothing, then the operation was included —
     * which is what moved the nonce — before the nonce was read. Dropping it
     * on the nonce alone would forget a payment that landed.
     */
    it('confirms a payment included between the receipt lookup and the nonce read', async () => {
      sentAt(PAST_TTL);
      const asked: string[] = [];
      mockGetReceipt.mockImplementation(async () => {
        asked.push('receipt');
        throw notFound();
      });
      mockGetNonce.mockImplementation(async () => {
        asked.push('nonce');
        return 8n;
      });
      mockGetEvents.mockImplementation(async () => {
        asked.push('chain');
        return [included(HASH, true)];
      });

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'confirmed',
        state: STATE,
      });
      // Looked up again only after the nonce was read, so it sees the inclusion.
      expect(asked).toEqual(['receipt', 'nonce', 'chain']);
      expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
      expect(stored()).toEqual([]);
    });

    it('keeps it, landed, while that confirm fails', async () => {
      sentAt(PAST_TTL);
      mockGetEvents.mockResolvedValue([included(HASH, true)]);
      mockUpgrade.mockRejectedValue(new Error('502'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toEqual([
        expect.objectContaining({ userOpHash: HASH, transactionHash: TX }),
      ]);
    });

    /** Included and reverted: nonce 7 is spent on a batch that moved nothing. */
    it('drops it when the chain shows it reverted', async () => {
      sentAt(PAST_TTL);
      mockGetEvents.mockResolvedValue([included(HASH, false)]);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockUpgrade).not.toHaveBeenCalled();
      expect(stored()).toEqual([]);
    });

    it('stays pending when the chain cannot be searched', async () => {
      sentAt(PAST_TTL);
      mockGetEvents.mockRejectedValue(new Error('rpc'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toHaveLength(1);
    });

    it('searches from the start of the chain for a record with no block', async () => {
      sentAt(PAST_TTL, { block: undefined });

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 0n }));
    });

    /** A replacement and the payment it replaced share nonce 7; either may be the one that used it. */
    it('confirms a payment it replaced, as the tier that one paid for', async () => {
      const EARLIER = '0x2222222222222222222222222222222222222222222222222222222222222222';
      const EARLIER_TX = '0x3333333333333333333333333333333333333333333333333333333333333333';
      sentAt(PAST_TTL, { replaced: [{ userOpHash: EARLIER, tier: RewardsTier.PRIME }] });
      mockGetEvents.mockResolvedValue([included(EARLIER, true, EARLIER_TX)]);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'confirmed',
        state: STATE,
      });
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({ args: { userOpHash: [HASH, EARLIER] } }),
      );
      expect(mockUpgrade).toHaveBeenCalledWith({
        tier: RewardsTier.PRIME,
        transactionHash: EARLIER_TX,
      });
      expect(stored()).toEqual([]);
    });
  });

  /** Nonce 7 unused: the signed operation can still land, and pay. */
  describe('while its nonce is unused', () => {
    beforeEach(() => mockGetNonce.mockResolvedValue(7n));

    it('is kept past the TTL while the bundler still has it', async () => {
      sentAt(PAST_TTL);

      for (const status of ['not_submitted', 'submitted', 'included', 'queued']) {
        mockGetStatus.mockResolvedValue({ status, transactionHash: null });
        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'pending',
        });
      }
      expect(mockGetStatus).toHaveBeenCalledWith({ hash: HASH });
      expect(stored()).toEqual([expect.not.objectContaining({ replaceable: true })]);
    });

    /**
     * Gone from the bundler — but a signed operation with an unused nonce is
     * never provably dead, so it is not forgotten. A new payment may replace
     * it, sent with nonce 7, and only one of the two can ever land.
     */
    it('may be replaced once the bundler says it no longer has it, and is kept', async () => {
      for (const status of ['not_found', 'rejected', 'failed']) {
        usePendingTierUpgradeStore.setState({ upgrades: {} });
        sentAt(PAST_TTL);
        mockGetStatus.mockResolvedValue({ status, transactionHash: null });

        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'replaceable',
          upgrade: expect.objectContaining({ userOpHash: HASH, nonce: '7' }),
          nonce: 7n,
        });
        expect(stored()).toEqual([
          expect.objectContaining({ userOpHash: HASH, replaceable: true }),
        ]);
      }
    });

    it('stays pending when the nonce or the status cannot be read', async () => {
      sentAt(PAST_TTL);
      mockGetNonce.mockRejectedValueOnce(new Error('rpc'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });

      mockGetStatus.mockRejectedValue(new Error('bundler'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toEqual([expect.not.objectContaining({ replaceable: true })]);
    });

    /**
     * The bound: a bundler that keeps saying "queued", or cannot be asked,
     * holds the user up for a day at most. Then a new payment may go ahead —
     * only as the replacement, with nonce 7 — and the record stays, since the
     * earlier operation may still be the one that lands.
     */
    it('may be replaced a day after it was sent, whatever the bundler says, and is kept', async () => {
      sentAt(NOW - PENDING_TIER_UPGRADE_MAX_HOLD_MS - 1);
      mockGetStatus.mockResolvedValue({ status: 'submitted', transactionHash: null });

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'replaceable',
        upgrade: expect.objectContaining({ userOpHash: HASH }),
        nonce: 7n,
      });
      expect(mockGetStatus).not.toHaveBeenCalled();
      expect(stored()).toEqual([expect.objectContaining({ userOpHash: HASH, replaceable: true })]);
    });

    /** Past the hold the nonce still decides: unread, nothing may take it. */
    it('stays pending past the hold while the nonce cannot be read', async () => {
      sentAt(NOW - PENDING_TIER_UPGRADE_MAX_HOLD_MS - 1);
      mockGetNonce.mockRejectedValue(new Error('rpc'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toHaveLength(1);
    });

    /** Found replaceable, then landed after all: a payment to confirm again. */
    it('confirms a replaceable record whose receipt turns up after all', async () => {
      sentAt(PAST_TTL, { replaceable: true });
      mockGetReceipt.mockResolvedValue({ success: true, receipt: { transactionHash: TX } });
      mockUpgrade.mockRejectedValue(new Error('502'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toEqual([expect.objectContaining({ transactionHash: TX })]);
      expect(stored()[0].replaceable).toBeUndefined();
    });
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

/**
 * A screen waits to confirm a payment only while there may be one to confirm.
 * One found replaceable never landed: the screen goes back to paying, which
 * replaces it, rather than asking for a confirmation that can never come.
 */
describe('useHasPendingTierUpgrade', () => {
  /** What the hook answers, read off what a component rendering it shows. */
  const hasPending = (): string | undefined => {
    const Probe = () =>
      React.createElement('Text', null, String(useHasPendingTierUpgrade('user-1')));
    let tree: { toJSON: () => { children: string[] }; unmount: () => void } | undefined;
    act(() => {
      tree = create(React.createElement(Probe));
    });
    const shown = tree?.toJSON().children[0];
    act(() => tree?.unmount());
    return shown;
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('counts an upgrade that may still land, or has landed', () => {
    remember();
    expect(hasPending()).toBe('true');
  });

  it('does not count one found replaceable', () => {
    remember({ replaceable: true });
    expect(hasPending()).toBe('false');
  });
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
