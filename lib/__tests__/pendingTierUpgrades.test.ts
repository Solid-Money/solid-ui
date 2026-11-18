import React from 'react';
import { encodeAbiParameters, encodeEventTopics, erc20Abi, pad, toEventSelector } from 'viem';

import {
  PENDING_TIER_UPGRADE_MAX_HOLD_MS,
  PENDING_TIER_UPGRADE_TTL_MS,
  readTierUpgradeStart,
  REJECTED_TIER_UPGRADE_HOLD_MS,
  settlePendingTierUpgrades,
  upgradeRejectionMessage,
} from '@/lib/pendingTierUpgrades';
import { RewardsTier } from '@/lib/types';
import { isNoPaymentInTransaction } from '@/lib/upgradeRejection';
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
const mockGetBlockNumber = jest.fn();
const mockGetTransactionReceipt = jest.fn();
jest.mock('@/lib/wagmi', () => ({
  publicClient: () => ({
    getContractEvents: (args: unknown) => mockGetEvents(args),
    getBlockNumber: () => mockGetBlockNumber(),
    getTransactionReceipt: (args: unknown) => mockGetTransactionReceipt(args),
  }),
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
  usePendingTierUpgradeStore.setState({ upgrades: {}, sending: {} });
  mockGetReceipt.mockReset();
  mockGetStatus.mockReset();
  mockGetNonce.mockReset();
  mockGetEvents.mockReset().mockResolvedValue([]);
  mockGetBlockNumber.mockReset();
  mockGetTransactionReceipt.mockReset();
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

/**
 * A record from before the nonce was kept goes on the TTL alone. No released
 * build writes one; only a development build of the feature can have left it.
 */
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
  const KEY = `${SAFE}:7`;
  const BLOCK = '45000000';
  const PAST_TTL = NOW - PENDING_TIER_UPGRADE_TTL_MS - 1;
  const sentAt = (submittedAt: number, overrides: Partial<PendingTierUpgrade> = {}) =>
    remember({ submittedAt, sender: SAFE, nonce: '7', block: BLOCK, ...overrides });

  /** An operation of the Safe's that is none of the record's. */
  const OTHER = '0x7777777777777777777777777777777777777777777777777777777777777777';
  const OTHER_TX = '0x8888888888888888888888888888888888888888888888888888888888888888';

  /** The EntryPoint's `UserOperationEvent` for an operation of the Safe's it included. */
  const included = (
    userOpHash: string,
    success: boolean,
    transactionHash: string = TX,
    nonce: bigint = 7n,
  ) => ({
    args: { userOpHash, sender: SAFE, nonce, success },
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
   * after the nonce was read, says which operation of the Safe's used it.
   */
  describe('once the Safe’s nonce has moved past it', () => {
    beforeEach(() => mockGetNonce.mockResolvedValue(8n));

    /** Every operation on record has a hash, and none of them used it. */
    it('is let go, without asking the backend, once the chain shows another operation used it', async () => {
      sentAt(PAST_TTL);
      mockGetEvents.mockResolvedValue([included(OTHER, true, OTHER_TX)]);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockGetNonce).toHaveBeenCalledWith(expect.objectContaining({ address: SAFE }));
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'UserOperationEvent',
          args: { sender: SAFE },
          fromBlock: 45_000_000n,
          toBlock: 'latest',
        }),
      );
      expect(mockGetStatus).not.toHaveBeenCalled();
      expect(mockUpgrade).not.toHaveBeenCalled();
      expect(stored()).toEqual([]);
    });

    /** Used, so something used it: a chain read that cannot see it yet is behind, not an answer. */
    it('stays pending while the operation that used it cannot be found', async () => {
      sentAt(PAST_TTL);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toHaveLength(1);
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

    /**
     * Written by a development build before the block was kept: nothing to
     * bound a search with, so it goes on the TTL like one with no nonce,
     * rather than holding the account up on a search that may never answer.
     */
    it('goes on the TTL alone with no block', async () => {
      sentAt(PAST_TTL, { block: undefined });

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockGetNonce).not.toHaveBeenCalled();
      expect(mockGetEvents).not.toHaveBeenCalled();
      expect(stored()).toEqual([]);
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
      expect(mockUpgrade).toHaveBeenCalledWith({
        tier: RewardsTier.PRIME,
        transactionHash: EARLIER_TX,
      });
      expect(stored()).toEqual([]);
    });

    /**
     * The review case. A replacement was written to the record before it was
     * signed, the bundler accepted it, and the answer carrying its hash never
     * arrived. It lands, and uses nonce 7. Searching by the hashes on record
     * would find nothing, drop the record and let the next press pay again;
     * the operation that used the nonce is the payment.
     */
    it('confirms a replacement whose hash never arrived, by the nonce it used', async () => {
      const EARLIER = '0x2222222222222222222222222222222222222222222222222222222222222222';
      const REPLACEMENT = '0x4444444444444444444444444444444444444444444444444444444444444444';
      const REPLACEMENT_TX = '0x5555555555555555555555555555555555555555555555555555555555555555';
      // Written moments ago, so no TTL to wait out: with no hash there is no
      // receipt to wait for.
      sentAt(NOW - 60_000, {
        userOpHash: undefined,
        replaced: [{ userOpHash: EARLIER, tier: RewardsTier.PRIME }],
      });
      mockGetEvents.mockResolvedValue([
        // An earlier operation of the Safe's, with an earlier nonce.
        included(OTHER, true, OTHER_TX, 6n),
        included(REPLACEMENT, true, REPLACEMENT_TX),
      ]);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'confirmed',
        state: STATE,
      });
      expect(mockGetReceipt).not.toHaveBeenCalled();
      expect(mockUpgrade).toHaveBeenCalledWith({
        tier: RewardsTier.ULTRA,
        transactionHash: REPLACEMENT_TX,
      });
      expect(stored()).toEqual([]);
    });

    /**
     * No hash on record, and another operation of the Safe's — a swap, say —
     * took nonce 7 first. Asked to confirm it, the backend finds no payment
     * from the wallet in that transaction: nothing was paid for the upgrade,
     * and nothing sent for it can land now. Dropped, not held as a refusal.
     */
    it('drops, and does not hold, a record whose nonce an unrelated operation used', async () => {
      for (const reason of [
        'that transaction is not a payment sent from your wallet',
        'no payment from your wallet to Solid in that transaction',
      ]) {
        usePendingTierUpgradeStore.setState({ upgrades: {} });
        sentAt(NOW - 60_000, { userOpHash: undefined });
        mockGetEvents.mockResolvedValue([included(OTHER, true, OTHER_TX)]);
        mockUpgrade
          .mockReset()
          .mockRejectedValue(httpError(400, `We could not find your payment: ${reason}.`));

        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'none',
        });
        expect(mockUpgrade).toHaveBeenCalledWith({
          tier: RewardsTier.ULTRA,
          transactionHash: OTHER_TX,
        });
        expect(stored()).toEqual([]);
      }
    });

    it('keeps that operation, still unmatched, while its confirm fails', async () => {
      sentAt(NOW - 60_000, { userOpHash: undefined });
      mockGetEvents.mockResolvedValue([included(OTHER, true, OTHER_TX)]);
      mockUpgrade.mockRejectedValueOnce(httpError(503, 'Your payment has not landed yet.'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'pending',
      });
      expect(stored()).toEqual([
        expect.objectContaining({ userOpHash: OTHER, transactionHash: OTHER_TX, unmatched: true }),
      ]);

      // Next press: straight to the confirm, and the backend's answer decides.
      mockGetEvents.mockClear();
      mockUpgrade.mockRejectedValueOnce(
        httpError(
          400,
          'We could not find your payment: that transaction is not a payment sent from your wallet.',
        ),
      );
      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockGetEvents).not.toHaveBeenCalled();
      expect(stored()).toEqual([]);
    });

    /** It was a payment after all, and the backend refused it: held, as any refusal is. */
    it('still holds a refusal of the payment that used the nonce', async () => {
      sentAt(NOW - 60_000, { userOpHash: undefined });
      mockGetEvents.mockResolvedValue([included(OTHER, true, OTHER_TX)]);
      mockUpgrade.mockRejectedValue(
        httpError(400, 'Your payment of $799.00 is below the Ultra price of $999.00.'),
      );

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'rejected',
        message: 'Your payment of $799.00 is below the Ultra price of $999.00.',
      });
      expect(stored()).toEqual([expect.objectContaining({ rejectedAt: NOW })]);
    });

    /**
     * The record's own operation landed, and it carried the payment: an answer
     * that it holds none is not taken as leave to pay again.
     */
    it('holds “no payment” as a refusal for an operation known to be its own', async () => {
      sentAt(PAST_TTL);
      mockGetEvents.mockResolvedValue([included(HASH, true)]);
      mockUpgrade.mockRejectedValue(
        httpError(
          400,
          'We could not find your payment: no payment from your wallet to Solid in that transaction.',
        ),
      );

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'rejected',
        message:
          'We could not find your payment: no payment from your wallet to Solid in that transaction.',
      });
      expect(stored()).toEqual([expect.objectContaining({ rejectedAt: NOW })]);
    });

    /**
     * Two sends whose answers were both lost — Prime, then an Ultra
     * replacement — and an operation with neither hash used nonce 7. Its
     * transfer, not the order they were sent in, says which it was.
     */
    describe('with several operations of no hash, for different tiers', () => {
      const USDC = '0x2222222222222222222222222222222222222222';
      const TREASURY = '0x3333333333333333333333333333333333333333';
      const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
      const LANDED = '0x4444444444444444444444444444444444444444444444444444444444444444';
      const PRIME_PAYMENT = { token: USDC, to: TREASURY, units: '199000000' };
      const ULTRA_PAYMENT = { token: USDC, to: TREASURY, units: '799000000' };

      const transfer = (value: bigint) => ({
        address: USDC,
        topics: encodeEventTopics({
          abi: erc20Abi,
          eventName: 'Transfer',
          args: { from: SAFE, to: TREASURY },
        }),
        data: encodeAbiParameters([{ type: 'uint256' }], [value]),
      });
      const entryPointLog = (signature: string, topics: `0x${string}`[] = []) => ({
        address: ENTRY_POINT,
        topics: [toEventSelector(signature), ...topics],
        data: '0x' as const,
      });
      const userOperationEvent = (userOpHash: `0x${string}`) =>
        entryPointLog('UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)', [
          userOpHash,
          pad(SAFE),
          pad('0x0000000000000000000000000000000000000000'),
        ]);
      /** The bundle: another operation of the Safe's that paid 199, then the one that used nonce 7. */
      const bundle = (...ownLogs: object[]) => ({
        logs: [
          entryPointLog('BeforeExecution()'),
          transfer(199_000_000n),
          userOperationEvent(OTHER),
          ...ownLogs,
          userOperationEvent(LANDED),
        ],
      });

      const sentBoth = () =>
        sentAt(NOW - 60_000, {
          userOpHash: undefined,
          tier: RewardsTier.ULTRA,
          payment: ULTRA_PAYMENT,
          replaced: [{ tier: RewardsTier.PRIME, payment: PRIME_PAYMENT }],
        });

      beforeEach(() => mockGetEvents.mockResolvedValue([included(LANDED, true)]));

      it('confirms the earlier one, as its tier, when it made that one’s transfer', async () => {
        sentBoth();
        mockGetTransactionReceipt.mockResolvedValue(bundle(transfer(199_000_000n)));

        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'confirmed',
          state: STATE,
        });
        expect(mockGetTransactionReceipt).toHaveBeenCalledWith({ hash: TX });
        expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.PRIME, transactionHash: TX });
      });

      it('confirms the latest, as its tier, when it made that one’s', async () => {
        sentBoth();
        mockGetTransactionReceipt.mockResolvedValue(bundle(transfer(799_000_000n)));

        await settlePendingTierUpgrades('user-1', NOW);

        expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
      });

      /** Another operation in the bundle paid 199: only the one that used the nonce counts. */
      it('drops the record, without asking the backend, when it made neither', async () => {
        sentBoth();
        mockGetTransactionReceipt.mockResolvedValue(bundle(transfer(5_000_000n)));

        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'none',
        });
        expect(mockUpgrade).not.toHaveBeenCalled();
        expect(stored()).toEqual([]);
      });

      it('stays pending when the transaction cannot be read', async () => {
        sentBoth();
        mockGetTransactionReceipt.mockRejectedValue(new Error('rpc'));

        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'pending',
        });
        expect(mockUpgrade).not.toHaveBeenCalled();
        expect(stored()).toHaveLength(1);
      });

      /**
       * Two Prime attempts make the same transfer: matching both says Prime,
       * whichever of them it was — not the newer Ultra attempt.
       */
      it('confirms the one tier several matching attempts share', async () => {
        sentAt(NOW - 60_000, {
          userOpHash: undefined,
          tier: RewardsTier.ULTRA,
          payment: ULTRA_PAYMENT,
          replaced: [
            { tier: RewardsTier.PRIME, payment: PRIME_PAYMENT },
            { tier: RewardsTier.PRIME, payment: PRIME_PAYMENT },
          ],
        });
        mockGetTransactionReceipt.mockResolvedValue(bundle(transfer(199_000_000n)));

        await settlePendingTierUpgrades('user-1', NOW);

        expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.PRIME, transactionHash: TX });
      });

      /**
       * Two tiers it could be — priced alike, or recorded without their
       * transfer by an unreleased build — and no way to tell: never guessed.
       */
      it('stays pending when the evidence names more than one tier', async () => {
        const cases: { payment?: typeof ULTRA_PAYMENT; paid: bigint }[] = [
          // Priced alike: both attempts make the one transfer it made.
          { payment: ULTRA_PAYMENT, paid: 799_000_000n },
          // Recorded without their transfer: none on record to match.
          { payment: undefined, paid: 5_000_000n },
        ];
        for (const { payment, paid } of cases) {
          usePendingTierUpgradeStore.setState({ upgrades: {} });
          sentAt(NOW - 60_000, {
            userOpHash: undefined,
            tier: RewardsTier.ULTRA,
            payment,
            replaced: [{ tier: RewardsTier.PRIME, payment }],
          });
          mockGetTransactionReceipt.mockResolvedValue(bundle(transfer(paid)));

          await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
            status: 'pending',
          });
          expect(mockUpgrade).not.toHaveBeenCalled();
          expect(stored()).toHaveLength(1);
        }
      });

      /**
       * Prime's transfer matches, but an Ultra attempt recorded without its
       * transfer may have made the same one: it cannot be ruled out.
       */
      it('stays pending when an attempt with no transfer on record could be it', async () => {
        sentAt(NOW - 60_000, {
          userOpHash: undefined,
          tier: RewardsTier.PRIME,
          payment: PRIME_PAYMENT,
          replaced: [{ tier: RewardsTier.ULTRA }],
        });
        mockGetTransactionReceipt.mockResolvedValue(bundle(transfer(199_000_000n)));

        await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
          status: 'pending',
        });
        expect(mockUpgrade).not.toHaveBeenCalled();
        expect(stored()).toHaveLength(1);
      });

      /** One tier among them: nothing to tell apart, and the transaction is not read. */
      it('takes the one tier there is without reading the transaction', async () => {
        sentAt(NOW - 60_000, {
          userOpHash: undefined,
          tier: RewardsTier.ULTRA,
          payment: ULTRA_PAYMENT,
          replaced: [{ tier: RewardsTier.ULTRA, payment: ULTRA_PAYMENT }],
        });

        await settlePendingTierUpgrades('user-1', NOW);

        expect(mockGetTransactionReceipt).not.toHaveBeenCalled();
        expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
      });
    });

    /**
     * The bundler cannot be asked for a receipt, however long it stays down:
     * the chain still says what used the nonce.
     */
    it('is settled by its nonce when the receipt lookup keeps failing', async () => {
      sentAt(PAST_TTL);
      mockGetReceipt.mockRejectedValue(new Error('bundler down'));
      mockGetEvents.mockResolvedValue([included(HASH, true)]);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'confirmed',
        state: STATE,
      });
      expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
    });

    /** Nonce 7 spent on a batch that moved nothing, whoever sent it. */
    it('drops a record with no hash when the operation that used its nonce reverted', async () => {
      sentAt(NOW - 60_000, { userOpHash: undefined });
      mockGetEvents.mockResolvedValue([included(OTHER, false, OTHER_TX)]);

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({ status: 'none' });
      expect(mockUpgrade).not.toHaveBeenCalled();
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
          key: KEY,
          upgrade: expect.objectContaining({ userOpHash: HASH, nonce: '7', replaceable: true }),
          nonce: 7n,
        });
        expect(stored()).toEqual([
          expect.objectContaining({ userOpHash: HASH, replaceable: true }),
        ]);
      }
    });

    /**
     * Its send failed with the outcome unknown, so no hash: no receipt to
     * wait for, no bundler to ask. A replacement with nonce 7 is safe at once —
     * a bundler that does hold it turns the replacement away.
     */
    it('may be replaced at once when it has no hash to ask about', async () => {
      sentAt(NOW - 60_000, { userOpHash: undefined });

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'replaceable',
        key: KEY,
        upgrade: expect.objectContaining({ nonce: '7', replaceable: true }),
        nonce: 7n,
      });
      expect(mockGetReceipt).not.toHaveBeenCalled();
      expect(mockGetStatus).not.toHaveBeenCalled();
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
        key: KEY,
        upgrade: expect.objectContaining({ userOpHash: HASH }),
        nonce: 7n,
      });
      expect(mockGetStatus).not.toHaveBeenCalled();
      expect(stored()).toEqual([expect.objectContaining({ userOpHash: HASH, replaceable: true })]);
    });

    /** A bundler down for good holds the user up no longer than the hold. */
    it('may be replaced after the hold when the receipt lookup keeps failing', async () => {
      sentAt(NOW - PENDING_TIER_UPGRADE_MAX_HOLD_MS - 1);
      mockGetReceipt.mockRejectedValue(new Error('bundler down'));

      await expect(settlePendingTierUpgrades('user-1', NOW)).resolves.toEqual({
        status: 'replaceable',
        key: KEY,
        upgrade: expect.objectContaining({ userOpHash: HASH }),
        nonce: 7n,
      });
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

/**
 * An unreachable bundler says nothing about whether the payment landed, and a
 * record with no nonce has nothing else to be settled by.
 */
it('stays pending when the lookup itself fails, however old, with no nonce', async () => {
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

  const UNACCEPTED_KEY = '0x1111111111111111111111111111111111111111:7';
  const unaccepted = {
    userOpHash: undefined,
    sender: '0x1111111111111111111111111111111111111111',
    nonce: '7',
    block: '1',
  };

  /** Written before signing: the screen does not change under the passkey prompt. */
  it('does not count one this app is still sending', () => {
    usePendingTierUpgradeStore.getState().setSending(UNACCEPTED_KEY, true);
    remember(unaccepted);
    expect(hasPending()).toBe('false');
  });

  /**
   * A send of unknown outcome left it with no hash, and its payment may have
   * left the Safe: what the balance now says cannot stop the press that
   * confirms it. So too after a restart, when nothing is being sent.
   */
  it('counts one with no hash once its send is over', () => {
    const { setSending } = usePendingTierUpgradeStore.getState();
    setSending(UNACCEPTED_KEY, true);
    remember(unaccepted);
    setSending(UNACCEPTED_KEY, false);
    expect(hasPending()).toBe('true');
  });
});

/**
 * Whatever uses the nonce lands at or after the block only if the block was
 * read first: the nonce unused when read, nothing has used it yet.
 */
it('reads where a payment starts: the block, then the nonce', async () => {
  const asked: string[] = [];
  mockGetBlockNumber.mockImplementation(async () => {
    asked.push('block');
    return 45_000_000n;
  });
  mockGetNonce.mockImplementation(async () => {
    asked.push('nonce');
    return 7n;
  });

  await expect(readTierUpgradeStart('0x1111111111111111111111111111111111111111')).resolves.toEqual(
    {
      block: '45000000',
      nonce: 7n,
    },
  );
  expect(asked).toEqual(['block', 'nonce']);
  expect(mockGetNonce).toHaveBeenCalledWith(
    expect.objectContaining({ address: '0x1111111111111111111111111111111111111111' }),
  );
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

describe('isNoPaymentInTransaction', () => {
  it('reads the backend’s two answers for a transaction with no payment from the wallet', async () => {
    for (const reason of [
      'that transaction is not a payment sent from your wallet',
      'no payment from your wallet to Solid in that transaction',
    ]) {
      await expect(
        isNoPaymentInTransaction(httpError(400, `We could not find your payment: ${reason}.`)),
      ).resolves.toBe(true);
    }
  });

  it('does not take a refusal of a real payment, or anything else, for one', async () => {
    for (const error of [
      httpError(400, 'Your payment of $799.00 is below the Ultra price of $999.00.'),
      httpError(400, 'We could not find your payment: the transaction reverted.'),
      httpError(409, 'That payment has already paid for a membership.'),
      httpError(400),
      new Error('no payment from your wallet to Solid in that transaction'),
    ]) {
      await expect(isNoPaymentInTransaction(error)).resolves.toBe(false);
    }
  });
});
