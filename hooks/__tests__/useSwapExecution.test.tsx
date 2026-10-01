import React, { useEffect } from 'react';

import { useSwapCallback } from '@/hooks/swap/useSwapCallback';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@cryptoalgebra/fuse-sdk', () => ({}));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('viem', () => ({ encodeFunctionData: () => '0x123', erc20Abi: [] }));
jest.mock('@/generated/wagmi', () => ({
  algebraRouterConfig: { address: '0xrouter', abi: [] },
}));
jest.mock('@/hooks/swap/useSwapCallArguments', () => ({
  useSwapCallArguments: () => mockCalls,
}));
// A null fee transaction is the no-fee path: the batch these tests assert on is
// the swap alone. Fee sizing and collection are covered by swapFee's own tests.
jest.mock('@/hooks/swap/useSwapFeeCollection', () => ({
  useSwapFeeCollection: () => ({ feeTransaction: null, reportCollectedFee: jest.fn() }),
}));
jest.mock('@/hooks/useApprove', () => ({
  useApproveCallbackFromTrade: () => mockApproval,
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: mockUser, safeAA: jest.fn().mockResolvedValue({}) }),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    trackTransaction: (_params: unknown, execute: (onHash: () => void) => Promise<unknown>) =>
      execute(jest.fn()),
  }),
}));
jest.mock('@/hooks/useTransactionAwait', () => ({
  useTransactionAwait: () => ({ isSuccess: false }),
}));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  selectedRewardsUserId: () => 'a',
  useRewardsUpgradeStore: { getState: () => ({ session: 0 }) },
}));

const mockCalls = [{ calldata: '0x123', value: '0x00' }];
let mockUser: any;
let mockApproval: { needAllowance: boolean; approvalConfig?: any };
const amount = {
  toSignificant: () => '100',
  currency: { symbol: 'USDC', isToken: false },
};
const trade = { inputAmount: amount, outputAmount: amount, to: '0xrouter', data: '0x123' };
const slippage = { toSignificant: () => '0.5' };
const receipt = { transactionHash: '0xhash', status: 'success' };
const execute = executeTransactions as jest.Mock;
let hook: ReturnType<typeof useSwapCallback>;
let root: ReturnType<typeof create>;
const onSuccess = jest.fn();

function StandardHarness({ hasTrade, swapTrade = trade }: { hasTrade: boolean; swapTrade?: any }) {
  const result = useSwapCallback(
    hasTrade ? swapTrade : undefined,
    slippage as any,
    { onSuccess } as any,
  );
  useEffect(() => {
    hook = result;
  });
  return null;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockUser = { userId: 'a', safeAddress: '0xwallet', suborgId: 'org', signWith: 'passkey' };
  mockApproval = { needAllowance: false };
  execute.mockResolvedValue(receipt);
});
afterEach(() => act(() => root?.unmount()));

describe('swap readiness and errors', () => {
  const mount = (hasTrade = true) =>
    act(() => {
      root = create(<StandardHarness hasTrade={hasTrade} />);
    });

  it('does not advertise an executable purchase without a wallet signer', () => {
    mockUser.signWith = undefined;
    mount();
    expect(hook.callback).toBeFalsy();
    expect(hook.error).toContain('wallet is not ready');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not advertise an executable purchase without a quote', () => {
    mount(false);
    expect(hook.callback).toBeFalsy();
    expect(hook.error).toContain('quote');
  });

  it('propagates an execution failure to the purchase button', async () => {
    execute.mockRejectedValueOnce(new Error('Wallet confirmation failed'));
    mount();
    await act(async () => {
      await expect(hook.callback!()).rejects.toThrow('Wallet confirmation failed');
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps cancellation separate from failed or successful purchases', async () => {
    execute.mockResolvedValueOnce(USER_CANCELLED_TRANSACTION);
    mount();
    await act(async () => {
      await expect(hook.callback!()).resolves.toBeUndefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('confirms a successful purchase once', async () => {
    mount();
    await act(async () => {
      await expect(hook.callback!()).resolves.toEqual(receipt);
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('token approval', () => {
  const token = { symbol: 'USDC', isToken: true, address: '0xtoken' };
  const tokenAmount = { toSignificant: () => '100', currency: token };
  const tokenTrade = { ...trade, inputAmount: tokenAmount };
  const approval = {
    request: { address: '0xtoken', abi: [], functionName: 'approve', args: ['0xrouter', 100n] },
  };
  const batch = () => execute.mock.calls[0][1] as { to: string }[];

  const swap = async () => {
    act(() => {
      root = create(<StandardHarness hasTrade swapTrade={tokenTrade} />);
    });
    await act(async () => {
      await hook.callback!();
    });
  };

  it('adds no approval when the allowance already covers the swap', async () => {
    mockApproval = { needAllowance: false };
    await swap();
    expect(batch().map(tx => tx.to)).toEqual(['0xrouter']);
  });

  it('approves the exact amount ahead of the swap when the allowance falls short', async () => {
    mockApproval = { needAllowance: true, approvalConfig: approval };
    await swap();
    expect(batch().map(tx => tx.to)).toEqual(['0xtoken', '0xrouter']);
  });
});
