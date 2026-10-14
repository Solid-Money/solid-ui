import React, { useEffect } from 'react';
import { decodeFunctionData, erc20Abi } from 'viem';
import { base } from 'viem/chains';

import useDepositFromSolidEur from '@/hooks/useDepositFromSolidEur';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import { Status, TransactionStatus } from '@/lib/types';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';

jest.mock('@/store/useUserStore', () => {
  // Jest factories resolve mocks before ES imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return {
    useUserStore: create(() => ({
      users: [{ userId: 'a', selected: true }],
      updateUser: jest.fn(),
    })),
  };
});
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: { userId: 'a', safeAddress: '0x123', suborgId: 'org', signWith: 'passkey' },
    safeAA: mockSafeAA,
  }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: any) => selector({ srcChainId: 8453 }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
// 1,000 EURC in the Safe.
jest.mock('wagmi', () => ({
  useBlockNumber: () => ({}),
  useReadContract: () => ({ data: 1_000_000_000n, refetch: jest.fn() }),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/deposit/soEurc', () => ({
  ...jest.requireActual('@/lib/deposit/soEurc'),
  readSoEurcDepositRate: jest.fn().mockResolvedValue(1_000_000n),
}));
jest.mock('@/lib/deposit/telemetry', () => ({
  captureDepositError: (e: Error) => e.message,
  depositBreadcrumb: jest.fn(),
  trackDepositCompleted: jest.fn(),
  trackDepositInitiated: jest.fn(),
  trackDepositValidated: jest.fn(),
}));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    createActivity: jest.fn().mockResolvedValue('activity'),
    updateActivity: mockUpdateActivity,
  }),
}));
jest.mock('@/lib/refreshRewardsAfterSavings', () => ({ refreshRewardsAfterSavings: jest.fn() }));

const mockUpdateActivity = jest.fn();
const mockSafeAA = jest.fn().mockResolvedValue({});
const execute = executeTransactions as jest.Mock;
let hook: ReturnType<typeof useDepositFromSolidEur>;
let root: ReturnType<typeof create>;
function Harness() {
  const result = useDepositFromSolidEur(EURC, 'EURC', '10');
  useEffect(() => {
    hook = result;
  });
  return null;
}
const receipt = { transactionHash: '0xabc', transaction: { status: 'success' } };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  useUserStore.setState({ users: [{ userId: 'a', selected: true } as any] });
  useRewardsUpgradeStore.setState({ userId: 'a', session: 0 });
  act(() => {
    root = create(<Harness />);
  });
});
afterEach(() => act(() => root.unmount()));

it('deposits from the Safe on Base: EURC approved to the vault, then the teller', async () => {
  execute.mockResolvedValue(receipt);
  await act(async () => {
    expect(await hook.deposit('100')).toBe('activity');
  });

  expect(mockSafeAA).toHaveBeenCalledWith(base, 'org', 'passkey');
  const [, transactions, , chain] = execute.mock.calls[0];
  expect(chain).toBe(base);
  expect(transactions).toHaveLength(2);

  const approval = decodeFunctionData({ abi: erc20Abi, data: transactions[0].data });
  expect(transactions[0].to.toLowerCase()).toBe(EURC.toLowerCase());
  expect(approval.args).toEqual([ADDRESSES.base.soEurcVault, 100_000_000n]);

  const deposit = decodeFunctionData({ abi: ETHEREUM_TELLER_ABI, data: transactions[1].data });
  expect(transactions[1].to).toBe(ADDRESSES.base.soEurcTeller);
  // 100 EURC at par is 100 soEURC; the mint may land at most 0.5% short.
  expect(deposit.args).toEqual([expect.any(String), 100_000_000n, 99_500_000n]);

  expect(mockUpdateActivity).toHaveBeenLastCalledWith(
    'activity',
    expect.objectContaining({
      status: TransactionStatus.SUCCESS,
      hash: '0xabc',
      url: 'https://basescan.org/tx/0xabc',
    }),
  );
  expect(hook.depositStatus.status).toBe(Status.SUCCESS);
  expect(refreshRewardsAfterSavings).toHaveBeenCalledTimes(1);
});

it('refuses a deposit under the minimum before signing anything', async () => {
  await act(async () => {
    await expect(hook.deposit('5')).rejects.toThrow('Minimum deposit amount is 10 EURC');
  });
  expect(execute).not.toHaveBeenCalled();
});

it('refuses more than the Safe holds', async () => {
  await act(async () => {
    await expect(hook.deposit('1000.01')).rejects.toThrow('Insufficient');
  });
  expect(execute).not.toHaveBeenCalled();
});

it('marks a cancelled deposit cancelled, never successful', async () => {
  execute.mockResolvedValue(USER_CANCELLED_TRANSACTION);
  await act(async () => {
    await expect(hook.deposit('100')).rejects.toThrow('cancelled');
  });
  expect(mockUpdateActivity).toHaveBeenLastCalledWith(
    'activity',
    expect.objectContaining({ status: TransactionStatus.CANCELLED }),
  );
  expect(refreshRewardsAfterSavings).not.toHaveBeenCalled();
});

it('never treats an unconfirmed receipt as success', async () => {
  execute.mockResolvedValue({ transactionHash: '0xabc', transaction: { status: 'reverted' } });
  await act(async () => {
    await expect(hook.deposit('100')).rejects.toThrow('not been confirmed');
  });
  expect(mockUpdateActivity).toHaveBeenLastCalledWith(
    'activity',
    expect.objectContaining({ status: TransactionStatus.FAILED }),
  );
});
