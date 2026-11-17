import React from 'react';
import { decodeFunctionData, erc20Abi } from 'viem';

import { useSubscribeToTier } from '@/hooks/useTierMembership';
import { SolidSubscriptionModule_ABI } from '@/lib/abis/SolidSubscriptionModule';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { RewardsTier, type TierMembershipContracts, type TierOffer } from '@/lib/types';
import { usePendingTierUpgradeStore } from '@/store/usePendingTierUpgradeStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

type MutationFn = (variables: Record<string, unknown>) => Promise<unknown>;
let mockMutationFn: MutationFn | undefined;
let mockOnError: ((error: Error) => void) | undefined;
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({}),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (options: { mutationFn: MutationFn; onError: (error: Error) => void }) => {
    mockMutationFn = options.mutationFn;
    mockOnError = options.onError;
    return {};
  },
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: {
      userId: 'user-1',
      suborgId: 'suborg',
      signWith: '0xwallet',
      safeAddress: '0x1111111111111111111111111111111111111111',
    },
    safeAA: jest.fn().mockResolvedValue({}),
  }),
}));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));
const mockConfirm = jest.fn();
const mockUpgrade = jest.fn();
jest.mock('@/lib/api', () => ({
  confirmTierSubscription: (body: unknown) => mockConfirm(body),
  upgradeTierSubscription: (body: unknown) => mockUpgrade(body),
}));
jest.mock('@/lib/config', () => ({ ADDRESSES: { fuse: {} } }));
jest.mock('@/lib/errors', () => ({
  ...jest.requireActual('@/lib/errors/UserCopyError'),
  getUserErrorMessage: () => 'Check the details and try again.',
  sanitizeTechnicalMessage: () => 'Sanitized error',
}));
const mockExecuteTransactions = jest.fn();
jest.mock('@/lib/execute', () => ({
  USER_CANCELLED_TRANSACTION: 'cancelled',
  executeTransactions: (...args: unknown[]) => mockExecuteTransactions(...args),
}));
jest.mock('@/lib/pendingTierLocks', () => ({
  isReceiptTimeout: (error: Error) => error.name === 'WaitForUserOperationReceiptTimeoutError',
}));
const mockSettle = jest.fn();
const mockStart = jest.fn();
jest.mock('@/lib/pendingTierUpgrades', () => ({
  settlePendingTierUpgrades: (userId: string) => mockSettle(userId),
  readTierUpgradeStart: (sender: string) => mockStart(sender),
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
jest.mock('@/lib/wagmi', () => ({ publicClient: () => ({}) }));
jest.mock('@/lib/utils', () => ({}));
jest.mock('@/store/useUserStore', () => ({}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({}));

const SAFE = '0x1111111111111111111111111111111111111111';
const MODULE = '0x2222222222222222222222222222222222222222';
const USDC = '0x3333333333333333333333333333333333333333';
const TREASURY = '0x4444444444444444444444444444444444444444';
/** The transfer an Ultra upgrade at $799 makes, as kept on its record. */
const ULTRA_PAYMENT = { token: USDC, to: TREASURY, units: '799000000' };
const HASH = '0x9418d2b5cd787c8accc4fa1d2a0844f0808c0945a1c8885dd33c9e4d8ce1a1f1';
const TX = '0x616c8066046af09a5054d4eb060eb8e30a9c8b30e0892399daa175da3aadaeab';
const STATE = { enabled: true };

const contracts: TierMembershipContracts = {
  chainId: 122,
  lockAddress: null,
  lockZapAddress: null,
  subscriptionModuleAddress: MODULE,
  shareTokenAddress: null,
  wrappedNativeAddress: null,
  billingTokenAddress: USDC,
  revenueTreasuryAddress: TREASURY,
};

/** Prime on sale to a first-time member: $159 now, $199 a year after. */
const primeSale: TierOffer = {
  tier: RewardsTier.PRIME,
  lockFuse: 50_000,
  lockAvailable: true,
  annualFeeUsd: 199,
  firstYearFeeUsd: 159,
  mandateUsd: 199,
  cashAvailable: true,
  held: false,
  paymentMode: 'module',
  replacesSubscription: null,
};

/** Ultra on sale to a Prime member: $799 now, $999 a year after, Prime ends today. */
const ultraUpgrade: TierOffer = {
  tier: RewardsTier.ULTRA,
  lockFuse: 600_000,
  lockAvailable: true,
  annualFeeUsd: 999,
  firstYearFeeUsd: 799,
  mandateUsd: 999,
  cashAvailable: true,
  held: false,
  paymentMode: 'transfer',
  replacesSubscription: { tier: RewardsTier.PRIME, currentPeriodEnd: '2027-03-01T00:00:00.000Z' },
};

const FUNDING = { transactionHash: '0xbridge', fromChainId: 8453 };
/** The EntryPoint nonce the operation is sent with. */
const NONCE = 7n;
/** The latest Fuse block, read before the nonce. */
const BLOCK = '45000000';

/** The bundler accepted the operation, then it landed. */
const lands = () =>
  mockExecuteTransactions.mockImplementation(
    async (
      _client: unknown,
      _calls: unknown,
      _message: string,
      _chain: unknown,
      onUserOpHash?: (hash: string, nonce: bigint) => void,
    ) => {
      onUserOpHash?.(HASH, NONCE);
      return { transaction: {}, userOpHash: HASH, transactionHash: TX };
    },
  );

const receiptTimeout = () =>
  Object.assign(new Error('Timed out while waiting for User Operation'), {
    name: 'WaitForUserOperationReceiptTimeoutError',
  });

/** The bundler accepted the operation, then the wait for its receipt gave up. */
const timesOut = () =>
  mockExecuteTransactions.mockImplementation(
    async (
      _client: unknown,
      _calls: unknown,
      _message: string,
      _chain: unknown,
      onUserOpHash?: (hash: string, nonce: bigint) => void,
    ) => {
      onUserOpHash?.(HASH, NONCE);
      throw receiptTimeout();
    },
  );

/** The calls the Safe was asked to sign. */
const signed = (): { to: string; data: `0x${string}`; value: bigint }[] =>
  mockExecuteTransactions.mock.calls[0][1];

const Probe = () => {
  useSubscribeToTier();
  return null;
};

const subscribe = (variables: Record<string, unknown>) => {
  let tree: { unmount: () => void } | undefined;
  act(() => {
    tree = create(<Probe />);
  });
  act(() => tree?.unmount());
  return mockMutationFn!(variables);
};

const stored = () => Object.values(usePendingTierUpgradeStore.getState().upgrades);

beforeEach(() => {
  usePendingTierUpgradeStore.setState({ upgrades: {}, sending: {} });
  mockExecuteTransactions.mockReset();
  mockConfirm.mockReset().mockResolvedValue(STATE);
  mockUpgrade.mockReset().mockResolvedValue(STATE);
  mockSettle.mockReset().mockResolvedValue({ status: 'none' });
  mockStart.mockReset().mockResolvedValue({ block: BLOCK, nonce: NONCE });
  mockTrack.mockReset();
  lands();
});

const tracked = () => mockTrack.mock.calls.map(([event]) => event);

describe('a module subscription', () => {
  it('signs the mandate at the annual fee during a sale, and confirms', async () => {
    await expect(
      subscribe({ offer: primeSale, contracts, moduleEnabled: false, funding: FUNDING }),
    ).resolves.toEqual(
      expect.objectContaining({ transactionHash: TX, priceUsd: 159, mode: 'module' }),
    );

    const calls = signed();
    expect(calls.map(call => call.to)).toEqual([SAFE, MODULE]);
    expect(
      decodeFunctionData({ abi: SolidSubscriptionModule_ABI, data: calls[1].data }).args?.[0],
    ).toBe(199_000_000n);

    expect(mockConfirm).toHaveBeenCalledWith({
      tier: RewardsTier.PRIME,
      transactionHash: TX,
      funding: FUNDING,
    });
    expect(mockUpgrade).not.toHaveBeenCalled();
    expect(mockSettle).not.toHaveBeenCalled();
  });

  /** An older backend sends none of the new fields: exactly today's flow. */
  it('treats an offer with no payment mode as a module subscription at the annual fee', async () => {
    const old: TierOffer = {
      tier: RewardsTier.PRIME,
      lockFuse: 50_000,
      lockAvailable: true,
      annualFeeUsd: 199,
      cashAvailable: true,
      held: false,
    };

    await subscribe({ offer: old, contracts, moduleEnabled: true });

    expect(signed().map(call => call.to)).toEqual([MODULE]);
    expect(
      decodeFunctionData({ abi: SolidSubscriptionModule_ABI, data: signed()[0].data }).args?.[0],
    ).toBe(199_000_000n);
    expect(mockConfirm).toHaveBeenCalledWith({ tier: RewardsTier.PRIME, transactionHash: TX });
  });
});

describe('an upgrade paid by transfer', () => {
  it('pays the first year to the treasury and signs the annual mandate, in one batch', async () => {
    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).resolves.toEqual(
      expect.objectContaining({ transactionHash: TX, priceUsd: 799, mode: 'transfer' }),
    );

    const calls = signed();
    expect(calls.map(call => call.to)).toEqual([USDC, MODULE]);
    expect(decodeFunctionData({ abi: erc20Abi, data: calls[0].data }).args).toEqual([
      TREASURY,
      799_000_000n,
    ]);
    expect(
      decodeFunctionData({ abi: SolidSubscriptionModule_ABI, data: calls[1].data }).args?.[0],
    ).toBe(999_000_000n);
    // Sent with the nonce read for its record, not one read again.
    expect(mockStart).toHaveBeenCalledWith(SAFE);
    expect(mockExecuteTransactions.mock.calls[0][6]).toBe(NONCE);
  });

  /**
   * On record before the passkey is asked for, under the Safe and the nonce
   * it is sent with: a payment the bundler accepts is always on record, even
   * when the answer carrying its hash is lost.
   */
  it('puts the payment on record before signing, then adds its hash', async () => {
    let atSigning: unknown[] = [];
    let sendingAtSigning: Record<string, true> = {};
    mockExecuteTransactions.mockImplementation(
      async (
        _client: unknown,
        _calls: unknown,
        _message: string,
        _chain: unknown,
        onUserOpHash?: (hash: string, nonce: bigint) => void,
      ) => {
        atSigning = stored();
        sendingAtSigning = { ...usePendingTierUpgradeStore.getState().sending };
        onUserOpHash?.(HASH, NONCE);
        throw receiptTimeout();
      },
    );

    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).rejects.toThrow(/still confirming/);

    expect(atSigning).toEqual([
      {
        userId: 'user-1',
        submittedAt: expect.any(Number),
        tier: RewardsTier.ULTRA,
        payment: ULTRA_PAYMENT,
        sender: SAFE,
        nonce: '7',
        block: BLOCK,
      },
    ]);
    // Being sent while the passkey is up, so no screen takes it for a payment
    // to confirm; over once the attempt is.
    expect(sendingAtSigning).toEqual({ [`${SAFE}:7`]: true });
    expect(usePendingTierUpgradeStore.getState().sending).toEqual({});
    expect(stored()).toEqual([expect.objectContaining({ userOpHash: HASH, nonce: '7' })]);
  });

  /** Dismissed before the bundler had anything: nothing can land, so nothing stays on record. */
  it('takes the record back when the passkey prompt is dismissed', async () => {
    let atSigning: unknown[] = [];
    mockExecuteTransactions.mockImplementation(async () => {
      atSigning = stored();
      return 'cancelled';
    });

    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).resolves.toBeNull();
    expect(atSigning).toHaveLength(1);
    expect(stored()).toEqual([]);
    expect(tracked()).toEqual(['tier_subscribe_cancelled']);
  });

  /** Read as a cancel after the bundler accepted it: sent all the same, so it stays. */
  it('keeps the record when a cancel comes after the bundler accepted it', async () => {
    mockExecuteTransactions.mockImplementation(
      async (
        _client: unknown,
        _calls: unknown,
        _message: string,
        _chain: unknown,
        onUserOpHash?: (hash: string, nonce: bigint) => void,
      ) => {
        onUserOpHash?.(HASH, NONCE);
        return 'cancelled';
      },
    );

    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).resolves.toBeNull();
    expect(stored()).toEqual([expect.objectContaining({ userOpHash: HASH })]);
  });

  it('takes the record back when the bundler refuses the payment', async () => {
    const refusal = Object.assign(new Error('UserOperation reverted during simulation'), {
      details: 'AA23 reverted: transfer amount exceeds balance',
    });
    mockExecuteTransactions.mockRejectedValue(refusal);

    await expect(subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true })).rejects.toBe(
      refusal,
    );
    expect(stored()).toEqual([]);
  });

  /**
   * Failed with no hash, in a way that may have reached the bundler — the
   * connection dropped while it answered. It may be a payment accepted with
   * only the answer lost: it stays on record, to be settled by its nonce.
   */
  it('keeps the record, with no hash, when the send may have reached the bundler', async () => {
    for (const failure of [
      new TypeError('Network request failed'),
      Object.assign(new Error('The request took too long to respond.'), { name: 'TimeoutError' }),
      new Error('UserOperation already known'),
    ]) {
      usePendingTierUpgradeStore.setState({ upgrades: {}, sending: {} });
      mockExecuteTransactions.mockRejectedValueOnce(failure);

      await expect(subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true })).rejects.toBe(
        failure,
      );
      expect(stored()).toEqual([
        {
          userId: 'user-1',
          submittedAt: expect.any(Number),
          tier: RewardsTier.ULTRA,
          payment: ULTRA_PAYMENT,
          sender: SAFE,
          nonce: '7',
          block: BLOCK,
        },
      ]);
      // The attempt is over: a payment that may have been made, to confirm.
      expect(usePendingTierUpgradeStore.getState().sending).toEqual({});
    }
  });

  it('writes nothing when the nonce cannot be read', async () => {
    mockStart.mockRejectedValue(new Error('rpc'));

    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).rejects.toThrow('rpc');
    expect(mockExecuteTransactions).not.toHaveBeenCalled();
    expect(stored()).toEqual([]);
  });

  /** The module allows one charge a period, and Prime's has been taken. */
  it('reports to the upgrade endpoint and never to confirm, with no funding claim', async () => {
    await subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true, funding: FUNDING });

    expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(stored()).toEqual([]);
  });

  it('refuses to sign without the treasury', async () => {
    await expect(
      subscribe({
        offer: ultraUpgrade,
        contracts: { ...contracts, revenueTreasuryAddress: null },
        moduleEnabled: true,
      }),
    ).rejects.toThrow(UserCopyError);
    expect(mockExecuteTransactions).not.toHaveBeenCalled();
  });

  /**
   * Paid, and only telling the backend failed. The record is what makes the
   * next press confirm this payment instead of paying a second time.
   */
  it('keeps the landed payment when the upgrade call fails', async () => {
    mockUpgrade.mockRejectedValue(new Error('502'));

    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).rejects.toThrow('you won’t be charged twice');
    expect(stored()).toEqual([
      expect.objectContaining({ userOpHash: HASH, transactionHash: TX, tier: RewardsTier.ULTRA }),
    ]);
  });

  /** A final 4xx: the user is told why, and the payment is held against a second one. */
  it('shows the backend refusal for a landed payment, and holds it', async () => {
    mockUpgrade.mockRejectedValue(
      new Response(
        JSON.stringify({ message: 'You already have this membership. Our team has been told.' }),
        { status: 409 },
      ),
    );

    await expect(
      subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
    ).rejects.toThrow('You already have this membership. Our team has been told.');
    expect(stored()).toEqual([
      expect.objectContaining({
        userOpHash: HASH,
        transactionHash: TX,
        rejectedAt: expect.any(Number),
      }),
    ]);
  });

  describe('pressing Upgrade again', () => {
    it('shows the earlier refusal instead of paying again', async () => {
      mockSettle.mockResolvedValue({ status: 'rejected', message: 'Below the Ultra price.' });

      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).rejects.toThrow('Below the Ultra price.');
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    it('signs nothing when the earlier payment is confirmed', async () => {
      mockSettle.mockResolvedValue({ status: 'confirmed', state: STATE });

      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).resolves.toEqual(expect.objectContaining({ state: STATE, mode: 'transfer' }));
      expect(mockSettle).toHaveBeenCalledWith('user-1');
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    it('signs nothing while the earlier payment is still settling', async () => {
      mockSettle.mockResolvedValue({ status: 'pending' });

      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).rejects.toThrow('no need to pay again');
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });
  });

  /**
   * A screen whose balance the earlier payment has already taken presses on
   * only to confirm it. It must never become a second payment.
   */
  describe('confirming an earlier payment only', () => {
    it('finishes the earlier payment', async () => {
      mockSettle.mockResolvedValue({ status: 'confirmed', state: STATE });

      await expect(
        subscribe({
          offer: ultraUpgrade,
          contracts,
          moduleEnabled: true,
          confirmPendingOnly: true,
        }),
      ).resolves.toEqual(expect.objectContaining({ state: STATE, mode: 'transfer' }));
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    it('signs nothing when there is no earlier payment left to finish', async () => {
      await expect(
        subscribe({
          offer: ultraUpgrade,
          contracts,
          moduleEnabled: true,
          confirmPendingOnly: true,
        }),
      ).rejects.toThrow(UserCopyError);
      expect(mockSettle).toHaveBeenCalledWith('user-1');
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    it('never signs a module subscription either', async () => {
      await expect(
        subscribe({
          offer: primeSale,
          contracts,
          moduleEnabled: true,
          confirmPendingOnly: true,
        }),
      ).rejects.toThrow(UserCopyError);
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    /**
     * Cash switched off after the payment was made: no module, no treasury,
     * no price. The payment is at the treasury all the same, and is confirmed
     * by its own hash.
     */
    it('finishes the earlier payment with cash switched off since', async () => {
      mockSettle.mockResolvedValue({ status: 'confirmed', state: STATE });

      await expect(
        subscribe({
          offer: {
            ...ultraUpgrade,
            cashAvailable: false,
            annualFeeUsd: null,
            firstYearFeeUsd: null,
          },
          contracts: {
            ...contracts,
            subscriptionModuleAddress: null,
            revenueTreasuryAddress: null,
          },
          moduleEnabled: true,
          confirmPendingOnly: true,
        }),
      ).resolves.toEqual(expect.objectContaining({ state: STATE, mode: 'transfer' }));
      expect(mockSettle).toHaveBeenCalledWith('user-1');
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });
  });

  /**
   * An earlier payment never landed, and the nonce it was sent with is still
   * unused, so it could in principle still be included. A new payment may go
   * ahead only as its replacement: with that same nonce, so that whichever of
   * the two is included, the other never can be.
   */
  describe('replacing an earlier payment that never landed', () => {
    const EARLIER = '0x5555555555555555555555555555555555555555555555555555555555555555';
    const earlier = {
      userOpHash: EARLIER,
      userId: 'user-1',
      submittedAt: 1_800_000_000_000,
      tier: RewardsTier.ULTRA,
      sender: SAFE,
      nonce: '7',
      block: '44000000',
      replaceable: true,
    } as const;

    /** The bundler accepted the replacement, then the wait for its receipt gave up. */
    const acceptedThenTimesOut = () =>
      mockExecuteTransactions.mockImplementation(
        async (
          _client: unknown,
          _calls: unknown,
          _message: string,
          _chain: unknown,
          onUserOpHash?: (hash: string, nonce: bigint) => void,
          _onBeforeBroadcast?: unknown,
          nonce?: bigint,
        ) => {
          onUserOpHash?.(HASH, nonce!);
          throw receiptTimeout();
        },
      );

    beforeEach(() => {
      usePendingTierUpgradeStore.getState().remember({ ...earlier });
      mockSettle.mockResolvedValue({
        status: 'replaceable',
        key: `${SAFE}:7`,
        upgrade: earlier,
        nonce: NONCE,
      });
    });

    it('sends with the earlier payment’s nonce, and moves the record to the new one', async () => {
      acceptedThenTimesOut();

      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).rejects.toThrow(/still confirming/);

      // The nonce override, and no fresh block or nonce: the search for
      // either operation starts where the earlier one was sent.
      expect(mockExecuteTransactions.mock.calls[0][6]).toBe(NONCE);
      expect(mockStart).not.toHaveBeenCalled();
      // One record, now the replacement, still answering for the earlier
      // payment until nonce 7 says which of the two used it.
      expect(stored()).toEqual([
        {
          userOpHash: HASH,
          userId: 'user-1',
          submittedAt: expect.any(Number),
          tier: RewardsTier.ULTRA,
          payment: ULTRA_PAYMENT,
          sender: SAFE,
          nonce: '7',
          block: '44000000',
          replaced: [{ userOpHash: EARLIER, tier: RewardsTier.ULTRA }],
        },
      ]);
    });

    it('confirms the replacement once it lands', async () => {
      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).resolves.toEqual(expect.objectContaining({ transactionHash: TX, mode: 'transfer' }));

      expect(mockExecuteTransactions.mock.calls[0][6]).toBe(NONCE);
      expect(mockUpgrade).toHaveBeenCalledWith({ tier: RewardsTier.ULTRA, transactionHash: TX });
      expect(stored()).toEqual([]);
    });

    /**
     * The bundler still holds the earlier payment — or it has just landed and
     * used the nonce. Nothing new was sent; the user is told so, and the
     * earlier record is kept for the next press to settle.
     */
    it('says so when the bundler turns the replacement away, and keeps the earlier record', async () => {
      for (const refusal of [
        Object.assign(new Error('UserOperation reverted during simulation'), {
          details: 'AA25 invalid account nonce',
        }),
        new Error(
          'Replacement UserOperation must have higher maxPriorityFeePerGas (old=1, new=1) and higher maxFeePerGas (old=1, new=1)',
        ),
      ]) {
        mockExecuteTransactions.mockRejectedValueOnce(refusal);
        mockTrack.mockReset();

        const failure = await subscribe({
          offer: ultraUpgrade,
          contracts,
          moduleEnabled: true,
        }).catch((error: Error) => error);

        expect(failure).toBeInstanceOf(UserCopyError);
        expect((failure as Error).message).toMatch(/still with the network/);
        expect((failure as Error).message).toMatch(/won’t be charged twice/);
        expect(stored()).toEqual([earlier]);
        mockOnError!(failure as Error);
        expect(tracked()).not.toContain('tier_subscribe_failed');
      }
    });

    it('shows any other failure before sending as it is', async () => {
      const other = new Error('Execution reverted');
      mockExecuteTransactions.mockRejectedValue(other);

      await expect(subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true })).rejects.toBe(
        other,
      );
      expect(stored()).toEqual([earlier]);
    });

    /** Dismissed before the bundler had it: the earlier payment's record, as it was. */
    it('puts the earlier record back when the passkey prompt is dismissed', async () => {
      let atSigning: unknown[] = [];
      mockExecuteTransactions.mockImplementation(async () => {
        atSigning = stored();
        return 'cancelled';
      });

      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).resolves.toBeNull();
      expect(atSigning).toEqual([
        expect.objectContaining({ replaced: [{ userOpHash: EARLIER, tier: RewardsTier.ULTRA }] }),
      ]);
      expect(stored()).toEqual([earlier]);
    });

    /**
     * The review case, from the sending side: the bundler may have accepted
     * the replacement, and the answer carrying its hash was lost. The record
     * already stands for it — nonce 7, no hash — and still for the payment it
     * replaced, so whichever uses the nonce is the one settled.
     */
    it('keeps the replacement on record, with no hash, when its answer is lost', async () => {
      const lost = new TypeError('Network request failed');
      mockExecuteTransactions.mockRejectedValue(lost);

      await expect(subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true })).rejects.toBe(
        lost,
      );
      expect(stored()).toEqual([
        {
          userId: 'user-1',
          submittedAt: expect.any(Number),
          tier: RewardsTier.ULTRA,
          payment: ULTRA_PAYMENT,
          sender: SAFE,
          nonce: '7',
          block: '44000000',
          replaced: [{ userOpHash: EARLIER, tier: RewardsTier.ULTRA }],
        },
      ]);
    });

    /**
     * Nothing to confirm — it never landed — and a press meant to confirm
     * never pays. Settling has marked it replaceable, so the screen stops
     * waiting on it and the user's next press pays.
     */
    it('signs nothing for a confirm-only press, and says the payment did not go through', async () => {
      await expect(
        subscribe({
          offer: ultraUpgrade,
          contracts,
          moduleEnabled: true,
          confirmPendingOnly: true,
        }),
      ).rejects.toThrow(/didn’t go through, and no money moved/);
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });
  });

  /**
   * The pending record only exists once the bundler has accepted the payment.
   * Until then — settlement, passkey prompt, send — a second attempt for the
   * same account, from this step or another step's own copy of the hook, must
   * not pass the same "nothing earlier" check and pay again.
   */
  describe('a second attempt while one is under way', () => {
    /**
     * Holds the next attempt at the passkey prompt until `release` is called.
     * `signing` resolves once it is there.
     */
    const heldAtSigning = () => {
      let release!: () => void;
      let reached!: () => void;
      const released = new Promise<void>(resolve => (release = resolve));
      const signing = new Promise<void>(resolve => (reached = resolve));
      mockExecuteTransactions.mockImplementationOnce(
        async (
          _client: unknown,
          _calls: unknown,
          _message: string,
          _chain: unknown,
          onUserOpHash?: (hash: string, nonce: bigint) => void,
        ) => {
          reached();
          await released;
          onUserOpHash?.(HASH, NONCE);
          return { transaction: {}, userOpHash: HASH, transactionHash: TX };
        },
      );
      return { release: () => release(), signing };
    };

    it('is refused, and signs nothing, until the first is over', async () => {
      const { release, signing } = heldAtSigning();

      const first = subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true });
      await signing;
      // Each call renders its own copy of the hook.
      const second = subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true });
      const failure = await second.catch((error: Error) => error);
      expect(failure).toBeInstanceOf(UserCopyError);
      expect((failure as Error).message).toMatch(/already under way/);
      expect((failure as Error).message).toMatch(/no need to pay again/);
      // Not a failed upgrade, and not reported as one.
      mockOnError!(failure as Error);
      expect(tracked()).not.toContain('tier_subscribe_failed');

      release();
      await expect(first).resolves.toEqual(expect.objectContaining({ mode: 'transfer' }));
      expect(mockExecuteTransactions).toHaveBeenCalledTimes(1);
      expect(mockSettle).toHaveBeenCalledTimes(1);

      // Released once the first is over: the next attempt goes ahead.
      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).resolves.toEqual(expect.objectContaining({ mode: 'transfer' }));
      expect(mockExecuteTransactions).toHaveBeenCalledTimes(2);
    });

    it('covers a confirm-only press too', async () => {
      const { release, signing } = heldAtSigning();

      const first = subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true });
      await signing;
      await expect(
        subscribe({
          offer: ultraUpgrade,
          contracts,
          moduleEnabled: true,
          confirmPendingOnly: true,
        }),
      ).rejects.toThrow(/already under way/);

      release();
      await first;
      expect(mockSettle).toHaveBeenCalledTimes(1);
    });

    it('is released when the first attempt fails', async () => {
      mockSettle.mockResolvedValueOnce({ status: 'pending' });

      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).rejects.toThrow('no need to pay again');
      await expect(
        subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true }),
      ).resolves.toEqual(expect.objectContaining({ mode: 'transfer' }));
    });

    it('leaves a module subscription alone', async () => {
      const { release, signing } = heldAtSigning();

      const first = subscribe({ offer: ultraUpgrade, contracts, moduleEnabled: true });
      await signing;
      await expect(
        subscribe({ offer: primeSale, contracts, moduleEnabled: true }),
      ).resolves.toEqual(expect.objectContaining({ mode: 'module' }));

      release();
      await first;
    });
  });

  /**
   * Sent, and only the wait for the receipt gave up — the app was
   * backgrounded. The payment has most likely landed, so the user is told it
   * is confirming rather than that it failed, and the record stays so the next
   * press confirms it instead of paying again.
   */
  describe('when the receipt wait gives up after sending', () => {
    it('says the payment is confirming, keeps the record, and is not a failure', async () => {
      timesOut();

      const failure = await subscribe({
        offer: ultraUpgrade,
        contracts,
        moduleEnabled: true,
      }).catch((error: Error) => error);

      expect(failure).toBeInstanceOf(UserCopyError);
      expect((failure as Error).message).toMatch(/still confirming/);
      expect((failure as Error).message).toMatch(/won’t be charged twice/);
      // With the Safe and the nonce it was sent with — what later says whether
      // an operation with no receipt can still land — and the block read
      // before sending, where a search of the chain for it starts.
      expect(stored()).toEqual([
        expect.objectContaining({
          userOpHash: HASH,
          tier: RewardsTier.ULTRA,
          sender: SAFE,
          nonce: '7',
          block: '45000000',
        }),
      ]);
      expect(stored()[0].replaced).toBeUndefined();
      expect(stored()[0].transactionHash).toBeUndefined();
      expect(mockUpgrade).not.toHaveBeenCalled();
      expect(tracked()).toEqual(['tier_subscribe_pending']);

      mockOnError!(failure as Error);
      expect(tracked()).not.toContain('tier_subscribe_failed');
    });

    it('is still a failure when it gave up before the bundler took it', async () => {
      mockExecuteTransactions.mockRejectedValue(receiptTimeout());

      const failure = await subscribe({
        offer: ultraUpgrade,
        contracts,
        moduleEnabled: true,
      }).catch((error: Error) => error);

      expect(failure).not.toBeInstanceOf(UserCopyError);
      mockOnError!(failure as Error);
      expect(tracked()).toEqual(['tier_subscribe_failed']);
    });

    it('leaves a module subscription as it was', async () => {
      timesOut();

      const failure = await subscribe({
        offer: primeSale,
        contracts,
        moduleEnabled: true,
      }).catch((error: Error) => error);

      expect(failure).not.toBeInstanceOf(UserCopyError);
      expect((failure as Error).name).toBe('WaitForUserOperationReceiptTimeoutError');
      expect(stored()).toEqual([]);
      mockOnError!(failure as Error);
      expect(tracked()).toEqual(['tier_subscribe_failed']);
    });
  });
});
