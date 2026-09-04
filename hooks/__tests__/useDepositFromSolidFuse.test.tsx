import React, { useEffect } from 'react';

import useDepositFromSolidFuse from '@/hooks/useDepositFromSolidFuse';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import { Status, TransactionStatus } from '@/lib/types';
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
    safeAA: jest.fn().mockResolvedValue({}),
  }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: any) => selector({ srcChainId: 122 }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('wagmi', () => ({
  useBlockNumber: () => ({}),
  useReadContract: () => ({ refetch: jest.fn() }),
  useBalance: () => ({ data: { value: 100000n * 10n ** 18n }, refetch: jest.fn() }),
}));
jest.mock('@/lib/config', () => ({
  ADDRESSES: {
    fuse: {
      nativeFeeToken: '0x0000000000000000000000000000000000000001',
      fuseTeller: '0x0000000000000000000000000000000000000002',
    },
  },
}));
jest.mock('@/constants/addresses', () => ({
  WRAPPED_FUSE: '0x0000000000000000000000000000000000000003',
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
const execute = executeTransactions as jest.Mock;
let hook: ReturnType<typeof useDepositFromSolidFuse>;
let root: ReturnType<typeof create>;
function Harness() {
  const result = useDepositFromSolidFuse('0x0000000000000000000000000000000000000000', 'FUSE');
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

it('starts rewards reconciliation only after a successful receipt', async () => {
  execute.mockResolvedValue(receipt);
  await act(async () => {
    expect(await hook.deposit('50000')).toBe('activity');
  });
  expect(hook.depositStatus.status).toBe(Status.SUCCESS);
  expect(refreshRewardsAfterSavings).toHaveBeenCalledTimes(1);
});
it.each([undefined, { transactionHash: '0xabc', transaction: { status: 'reverted' } }])(
  'never treats an unconfirmed receipt as success: %s',
  async result => {
    execute.mockResolvedValue(result);
    await act(async () => {
      await expect(hook.deposit('50000')).rejects.toThrow('not been confirmed');
    });
    expect(refreshRewardsAfterSavings).not.toHaveBeenCalled();
  },
);
it('preserves cancellation and does not reconcile or show success', async () => {
  execute.mockResolvedValue(USER_CANCELLED_TRANSACTION);
  await act(async () => {
    await expect(hook.deposit('50000')).rejects.toThrow('cancelled');
  });
  expect(mockUpdateActivity).toHaveBeenLastCalledWith(
    'activity',
    expect.objectContaining({ status: TransactionStatus.CANCELLED }),
  );
  expect(refreshRewardsAfterSavings).not.toHaveBeenCalled();
});
it('does not execute a second deposit while confirmation is outstanding', async () => {
  let resolve!: (result: any) => void;
  execute.mockReturnValue(
    new Promise(r => {
      resolve = r;
    }),
  );
  await act(async () => {
    const first = hook.deposit('50000');
    expect(await hook.deposit('50000')).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    resolve(receipt);
    await first;
  });
  expect(execute).toHaveBeenCalledTimes(1);
});
it('isolates a late receipt after the user switches accounts', async () => {
  execute.mockImplementation(async () => {
    useUserStore.setState({ users: [{ userId: 'b', selected: true } as any] });
    return receipt;
  });
  await act(async () => {
    expect(await hook.deposit('50000')).toBeUndefined();
  });
  expect(refreshRewardsAfterSavings).not.toHaveBeenCalled();
  expect(mockUpdateActivity).not.toHaveBeenCalledWith(
    'activity',
    expect.objectContaining({ status: TransactionStatus.FAILED }),
  );
});
it('fails before execution when balance is insufficient', async () => {
  await act(async () => {
    await expect(hook.deposit('100001')).rejects.toThrow('Insufficient');
  });
  expect(execute).not.toHaveBeenCalled();
});
