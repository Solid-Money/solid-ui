import React, { useEffect } from 'react';

import { NetworkFeeNotSponsoredError, useLifiSwapCallback } from '@/hooks/swap/useLifiSwapCallback';
import { getUserErrorMessage } from '@/lib/errors/classify';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { executeTransactions } from '@/lib/execute';
import { LifiSwapQuote } from '@/lib/types/lifi-swap';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/constants/chains', () => ({ CHAIN_NAMES: { 1: 'Ethereum', 122: 'Fuse' } }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: mockUser, safeAA: mockSafeAA }),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({ trackTransaction: mockTrack }),
}));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/lib/api/lifi-swap', () => ({ recordLifiSwapFee: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/wagmi', () => ({
  getChain: () => ({ id: 1, name: 'Ethereum', nativeCurrency: { symbol: 'ETH' } }),
  publicClient: () => ({ getBalance: mockGetBalance, readContract: mockReadContract }),
}));
jest.mock('@/store/lifiSwapStore', () => ({
  useLifiSwapStore: { getState: () => ({ actions: { track: jest.fn() } }) },
}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  selectedRewardsUserId: () => 'a',
  useRewardsUpgradeStore: { getState: () => ({ session: 0 }) },
}));

let mockUser: any;
const mockPrepare = jest.fn();
const mockSafeAA = jest.fn();
const mockGetBalance = jest.fn();
const mockReadContract = jest.fn();
const mockTrack = jest.fn((_params: unknown, execute: (onHash: () => void) => Promise<unknown>) =>
  execute(jest.fn()),
);
const execute = executeTransactions as jest.Mock;
let hook: ReturnType<typeof useLifiSwapCallback>;
let root: ReturnType<typeof create>;

/** How viem surfaced Pimlico's refusal for every Ethereum swap on Oct 14. */
const policyRefusal = Object.assign(
  new Error('Invalid parameters were provided to the RPC method.'),
  {
    name: 'InvalidParamsRpcError',
    details: 'sponsorshipPolicy perOpMaximumUsd reached',
  },
);

/** 0.005 ETH from Ethereum to USDCe on Fuse, as in the report. */
const quote = {
  id: 'q1',
  fromChainId: 1,
  toChainId: 122,
  fromToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18 },
  toToken: { address: '0xusdce', symbol: 'USDCe', decimals: 6 },
  fromAmount: '5000000000000000',
  toAmount: '12350870',
  slippage: 0.005,
  executionDurationSeconds: 180,
  approvalAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
  steps: [{ name: 'Stargate', tool: 'stargateV2', type: 'cross' }],
  solidFee: { percentage: 0, tierName: 'Free' },
  transactionRequest: {
    to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    data: '0xa6010a66',
    value: '5100000000000000',
    chainId: 1,
  },
} as unknown as LifiSwapQuote;

/** Gas limits for a first swap out of a new Safe, at 1 gwei: 0.00112 ETH up front. */
const preparedOp = {
  callGasLimit: 598_032n,
  verificationGasLimit: 447_206n,
  preVerificationGas: 80_432n,
  maxFeePerGas: 1_000_000_000n,
};
const prefund = (598_032n + 447_206n + 80_432n) * 1_000_000_000n;

function Harness() {
  const result = useLifiSwapCallback();
  useEffect(() => {
    hook = result;
  });
  return null;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockUser = { userId: 'a', safeAddress: '0xsafe', suborgId: 'org', signWith: 'passkey' };
  mockSafeAA.mockResolvedValue({ account: {}, prepareUserOperation: mockPrepare });
  mockPrepare.mockResolvedValue(preparedOp);
  execute.mockResolvedValue({
    transaction: { status: 'success' },
    transactionHash: '0xhash',
    userOpHash: '0xop',
  });
  act(() => {
    root = create(<Harness />);
  });
});
afterEach(() => act(() => root?.unmount()));

describe('a swap our paymaster will not sponsor', () => {
  it('hands the refusal back as an offer to pay the fee, not as an error', async () => {
    execute.mockRejectedValueOnce(policyRefusal);

    let caught: unknown;
    await act(async () => {
      await hook.swap(quote).catch(error => (caught = error));
    });

    expect(mockSafeAA).toHaveBeenCalledWith(expect.anything(), 'org', 'passkey', {
      sponsored: true,
    });
    expect(caught).toBeInstanceOf(NetworkFeeNotSponsoredError);
    expect((caught as NetworkFeeNotSponsoredError).chainId).toBe(1);
  });

  it('leaves any other failure as it was', async () => {
    const other = new Error('Execution reverted');
    execute.mockRejectedValueOnce(other);

    await act(async () => {
      await expect(hook.swap(quote)).rejects.toBe(other);
    });
  });
});

describe('paying the network fee from the Safe', () => {
  it('sends unsponsored once the Safe can prefund the gas and the swapped amount', async () => {
    mockGetBalance.mockResolvedValue(prefund + 5_100_000_000_000_000n);

    let result: unknown;
    await act(async () => {
      result = await hook.swap(quote, { payNetworkFee: true });
    });

    expect(mockSafeAA).toHaveBeenCalledWith(expect.anything(), 'org', 'passkey', {
      sponsored: false,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ kind: 'bridging', transactionHash: '0xhash' });
  });

  it('says what is missing, before any passkey prompt, when it cannot', async () => {
    // The amount and bridge fee are there; the worst-case gas is not.
    mockGetBalance.mockResolvedValue(5_100_000_000_000_000n + prefund - 1n);

    let caught: unknown;
    await act(async () => {
      await hook.swap(quote, { payNetworkFee: true }).catch(error => (caught = error));
    });

    expect(caught).toBeInstanceOf(UserCopyError);
    expect(getUserErrorMessage(caught)).toBe(
      'Not enough ETH on Ethereum to pay the network fee. Lower the amount or add ETH.',
    );
    expect(mockTrack).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not suggest a smaller amount when the amount is not the gas token', async () => {
    // The other failing Oct 14 route: USDC → EURC on Base, no ETH on Ethereum.
    mockReadContract.mockResolvedValue(0n);
    mockGetBalance.mockResolvedValue(0n);
    const usdcQuote = {
      ...quote,
      fromToken: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        decimals: 6,
      },
      fromAmount: '8000000',
      transactionRequest: { ...quote.transactionRequest, value: '0' },
    } as LifiSwapQuote;

    let caught: unknown;
    await act(async () => {
      await hook.swap(usdcQuote, { payNetworkFee: true }).catch(error => (caught = error));
    });

    expect(getUserErrorMessage(caught)).toBe(
      'Not enough ETH on Ethereum to pay the network fee. Add ETH to swap from Ethereum.',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('reads a bundler prefund refusal during estimation the same way', async () => {
    mockPrepare.mockRejectedValueOnce(
      Object.assign(new Error('UserOperation reverted'), { details: "AA21 didn't pay prefund" }),
    );

    await act(async () => {
      await expect(hook.swap(quote, { payNetworkFee: true })).rejects.toBeInstanceOf(UserCopyError);
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
