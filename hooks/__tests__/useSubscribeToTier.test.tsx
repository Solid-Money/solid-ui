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
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({}),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (options: { mutationFn: MutationFn }) => {
    mockMutationFn = options.mutationFn;
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
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
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
jest.mock('@/lib/pendingTierLocks', () => ({}));
const mockSettle = jest.fn();
jest.mock('@/lib/pendingTierUpgrades', () => ({
  settlePendingTierUpgrades: (userId: string) => mockSettle(userId),
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
jest.mock('@/lib/wagmi', () => ({}));
jest.mock('@/lib/utils', () => ({}));
jest.mock('@/store/useUserStore', () => ({}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({}));

const SAFE = '0x1111111111111111111111111111111111111111';
const MODULE = '0x2222222222222222222222222222222222222222';
const USDC = '0x3333333333333333333333333333333333333333';
const TREASURY = '0x4444444444444444444444444444444444444444';
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

/** The bundler accepted the operation, then it landed. */
const lands = () =>
  mockExecuteTransactions.mockImplementation(
    async (
      _client: unknown,
      _calls: unknown,
      _message: string,
      _chain: unknown,
      onUserOpHash?: (hash: string) => void,
    ) => {
      onUserOpHash?.(HASH);
      return { transaction: {}, userOpHash: HASH, transactionHash: TX };
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
  usePendingTierUpgradeStore.setState({ upgrades: {} });
  mockExecuteTransactions.mockReset();
  mockConfirm.mockReset().mockResolvedValue(STATE);
  mockUpgrade.mockReset().mockResolvedValue(STATE);
  mockSettle.mockReset().mockResolvedValue({ status: 'none' });
  lands();
});

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
});
