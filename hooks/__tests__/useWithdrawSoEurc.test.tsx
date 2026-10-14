import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { decodeFunctionData, erc20Abi } from 'viem';
import { base } from 'viem/chains';

import useWithdrawSoEurc from '@/hooks/useWithdrawSoEurc';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status } from '@/lib/types';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    trackTransaction: (params: unknown, execute: (onHash: () => void) => Promise<unknown>) => {
      mockTracked(params);
      return execute(jest.fn());
    },
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: { userId: 'a', safeAddress: '0xsafe', suborgId: 'org', signWith: 'passkey' },
    safeAA: mockSafeAA,
  }),
}));

const mockTracked = jest.fn();
const mockSafeAA = jest.fn().mockResolvedValue({});
const execute = executeTransactions as jest.Mock;
let hook: ReturnType<typeof useWithdrawSoEurc>;
let root: ReturnType<typeof create>;
function Harness() {
  const result = useWithdrawSoEurc();
  useEffect(() => {
    hook = result;
  });
  return null;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  act(() => {
    root = create(<Harness />);
  });
});
afterEach(() => act(() => root.unmount()));

it('approves the queue for the shares and requests EURC on Base', async () => {
  execute.mockResolvedValue({ transactionHash: '0xhash' });
  await act(async () => {
    await hook.withdrawSoEurc('25.5');
  });

  expect(mockSafeAA).toHaveBeenCalledWith(base, 'org', 'passkey');
  const [, transactions, , chain] = execute.mock.calls[0];
  expect(chain).toBe(base);

  // Shares are approved on the vault (the share token) to the queue, which pulls them.
  expect(transactions[0].to).toBe(ADDRESSES.base.soEurcVault);
  const approval = decodeFunctionData({ abi: erc20Abi, data: transactions[0].data });
  expect(approval.args).toEqual([ADDRESSES.base.soEurcBoringQueue, 25_500_000n]);

  expect(transactions[1].to).toBe(ADDRESSES.base.soEurcBoringQueue);
  const request = decodeFunctionData({ abi: BoringQueue_ABI, data: transactions[1].data });
  expect(request.functionName).toBe('requestOnChainWithdraw');
  const [assetOut, shares, discount, secondsToDeadline] = request.args as readonly [
    string,
    bigint,
    number,
    number,
  ];
  expect(assetOut.toLowerCase()).toBe(EURC.toLowerCase());
  expect(shares).toBe(25_500_000n);
  // Inside the queue's 1-100 bps window, and past its three-day minimum deadline.
  expect(discount).toBe(1);
  expect(secondsToDeadline).toBeGreaterThanOrEqual(259_200);

  expect(mockTracked).toHaveBeenCalledWith(
    expect.objectContaining({ symbol: 'soEURC', chainId: base.id }),
  );
});

it('surfaces a cancelled signature as an error', async () => {
  execute.mockResolvedValue(USER_CANCELLED_TRANSACTION);
  await act(async () => {
    await expect(hook.withdrawSoEurc('1')).rejects.toThrow('cancelled');
  });
});

it('reports an amount that does not parse like any other failure', async () => {
  await act(async () => {
    await expect(hook.withdrawSoEurc('not-a-number')).rejects.toThrow();
  });

  expect(execute).not.toHaveBeenCalled();
  expect(hook.withdrawSoEurcStatus).toBe(Status.ERROR);
  expect(hook.error).toBeTruthy();
  expect(Sentry.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ tags: { type: 'withdraw_soeurc_error' } }),
  );
});
