import React, { useEffect } from 'react';
import { decodeFunctionData, erc20Abi } from 'viem';
import { base } from 'viem/chains';

import { getStockVault, type StockVault } from '@/constants/stockVaults';
import useDepositFromSolidStock from '@/hooks/useDepositFromSolidStock';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { readStockVaultDepositRate } from '@/lib/deposit/stockVault';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import { Status, TransactionStatus, VaultType } from '@/lib/types';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

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
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
// 3 AAPLc in the Safe.
jest.mock('wagmi', () => ({
  useBlockNumber: () => ({}),
  useReadContract: (params: { address?: string }) => {
    mockReadAddress(params.address);
    return { data: 300_000_000n, refetch: mockRefetch };
  },
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/deposit/stockVault', () => ({
  ...jest.requireActual('@/lib/deposit/stockVault'),
  readStockVaultDepositRate: jest.fn().mockResolvedValue(100_000_000n),
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
    createActivity: mockCreateActivity,
    updateActivity: mockUpdateActivity,
  }),
}));
jest.mock('@/lib/refreshRewardsAfterSavings', () => ({ refreshRewardsAfterSavings: jest.fn() }));

const mockCreateActivity = jest.fn().mockResolvedValue('activity');
const mockUpdateActivity = jest.fn();
const mockSafeAA = jest.fn().mockResolvedValue({});
const mockReadAddress = jest.fn();
const mockRefetch = jest.fn();
const execute = executeTransactions as jest.Mock;
const aapl = getStockVault(VaultType.AAPL)!;
let hook: ReturnType<typeof useDepositFromSolidStock>;
let root: ReturnType<typeof create>;
let mockStock: StockVault | undefined;
function Harness() {
  const result = useDepositFromSolidStock(mockStock, '0.001');
  useEffect(() => {
    hook = result;
  });
  return null;
}
const receipt = { transactionHash: '0xabc', transaction: { status: 'success' } };
const mount = () =>
  act(() => {
    root = create(<Harness />);
  });
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockCreateActivity.mockResolvedValue('activity');
  useUserStore.setState({ users: [{ userId: 'a', selected: true } as any] });
  useRewardsUpgradeStore.setState({ userId: 'a', session: 0 });
  mockStock = aapl;
  mount();
});
afterEach(() => act(() => root.unmount()));

it('deposits from the Safe on Base: the stock token approved to its vault, then its teller', async () => {
  execute.mockResolvedValue(receipt);
  await act(async () => {
    expect(await hook.deposit('2')).toBe('activity');
  });

  expect(readStockVaultDepositRate).toHaveBeenCalledWith(aapl);
  expect(mockSafeAA).toHaveBeenCalledWith(base, 'org', 'passkey');
  const [, transactions, , chain] = execute.mock.calls[0];
  expect(chain).toBe(base);
  expect(transactions).toHaveLength(2);

  expect(transactions[0].to).toBe(aapl.stockToken.address);
  const approval = decodeFunctionData({ abi: erc20Abi, data: transactions[0].data });
  expect(approval.args).toEqual([aapl.vault, 200_000_000n]);

  expect(transactions[1].to).toBe(aapl.teller);
  const deposit = decodeFunctionData({ abi: ETHEREUM_TELLER_ABI, data: transactions[1].data });
  // 2 AAPLc at one for one is 2 soAAPL; the mint may land at most 0.5% short.
  expect(deposit.args).toEqual([aapl.stockToken.address, 200_000_000n, 199_000_000n]);

  expect(mockCreateActivity).toHaveBeenCalledWith(
    expect.objectContaining({ symbol: 'AAPLc', toAddress: aapl.vault, chainId: base.id }),
  );
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

it('reads the balance of the selected stock token', () => {
  expect(mockReadAddress).toHaveBeenLastCalledWith(aapl.stockToken.address);
});

it('refuses a deposit under the minimum before signing anything', async () => {
  await act(async () => {
    await expect(hook.deposit('0.0005')).rejects.toThrow('Minimum deposit amount is 0.001 AAPLc');
  });
  expect(execute).not.toHaveBeenCalled();
});

it('refuses more than the Safe holds', async () => {
  await act(async () => {
    await expect(hook.deposit('3.00000001')).rejects.toThrow('Insufficient');
  });
  expect(execute).not.toHaveBeenCalled();
});

it('marks a cancelled deposit cancelled, never successful', async () => {
  execute.mockResolvedValue(USER_CANCELLED_TRANSACTION);
  await act(async () => {
    await expect(hook.deposit('1')).rejects.toThrow('cancelled');
  });
  expect(mockUpdateActivity).toHaveBeenLastCalledWith(
    'activity',
    expect.objectContaining({ status: TransactionStatus.CANCELLED }),
  );
  expect(refreshRewardsAfterSavings).not.toHaveBeenCalled();
});

// The deposit form calls the hook for every vault: with another vault selected it does nothing.
it('deposits nothing while another vault is selected', async () => {
  act(() => root.unmount());
  mockRefetch.mockClear();
  mockStock = undefined;
  mount();
  await act(async () => {
    expect(await hook.deposit('1')).toBeUndefined();
  });
  expect(execute).not.toHaveBeenCalled();
  expect(mockRefetch).not.toHaveBeenCalled();
});
