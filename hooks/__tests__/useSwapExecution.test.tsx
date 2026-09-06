import React, { useEffect } from 'react';

import { useSwapCallback } from '@/hooks/swap/useSwapCallback';
import { useVoltageSwapCallback } from '@/hooks/swap/useVoltageSwapCallback';
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
jest.mock('@/hooks/useApprove', () => ({
  useApproveCallbackFromTrade: () => ({ needAllowance: false }),
  useApproveCallbackFromVoltageTrade: () => ({ needAllowance: false }),
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
const amount = {
  toSignificant: () => '100',
  currency: { symbol: 'USDC', isToken: false },
};
const trade = { inputAmount: amount, outputAmount: amount, to: '0xrouter', data: '0x123' };
const slippage = { toSignificant: () => '0.5' };
const receipt = { transactionHash: '0xhash', status: 'success' };
const execute = executeTransactions as jest.Mock;
let hook: ReturnType<typeof useSwapCallback> | ReturnType<typeof useVoltageSwapCallback>;
let root: ReturnType<typeof create>;
const onSuccess = jest.fn();

function StandardHarness({ hasTrade }: { hasTrade: boolean }) {
  const result = useSwapCallback(
    hasTrade ? (trade as any) : undefined,
    slippage as any,
    { onSuccess } as any,
  );
  useEffect(() => {
    hook = result;
  });
  return null;
}

function VoltageHarness({ hasTrade }: { hasTrade: boolean }) {
  const result = useVoltageSwapCallback(
    hasTrade ? (trade as any) : undefined,
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
  execute.mockResolvedValue(receipt);
});
afterEach(() => act(() => root?.unmount()));

describe.each([
  ['standard', false],
  ['Voltage', true],
] as const)('%s swap readiness and errors', (_name, voltage) => {
  const mount = (hasTrade = true) =>
    act(() => {
      root = create(
        voltage ? <VoltageHarness hasTrade={hasTrade} /> : <StandardHarness hasTrade={hasTrade} />,
      );
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
