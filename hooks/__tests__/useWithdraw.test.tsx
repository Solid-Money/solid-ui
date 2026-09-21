import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';

import useWithdraw from '@/hooks/useWithdraw';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('viem', () => ({
  erc20Abi: [],
  maxUint256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  parseUnits: (_val: string, _dec: number) => BigInt(1_000_000),
}));
jest.mock('viem/utils', () => ({
  encodeFunctionData: () => '0xdata',
  parseUnits: (_val: string, _dec: number) => BigInt(1_000_000),
}));
jest.mock('viem/chains', () => ({ mainnet: { id: 1 } }));
jest.mock('wagmi', () => ({
  useReadContract: () => ({
    data: BigInt(0),
    isLoading: false,
    refetch: jest.fn().mockResolvedValue({ data: BigInt(999_999_999) }),
  }),
}));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/hooks/useActivityActions', () => ({
  useActivityActions: () => ({
    trackTransaction: (_params: unknown, execute: (onHash: () => void) => Promise<unknown>) =>
      execute(jest.fn()),
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: {
      userId: 'user-1',
      safeAddress: '0xsafe',
      suborgId: 'org-1',
      signWith: 'passkey',
    },
    safeAA: jest.fn().mockResolvedValue({}),
  }),
}));
jest.mock('@/hooks/useVault', () => ({ VAULT: 'vault' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/config', () => ({
  ADDRESSES: {
    ethereum: {
      vault: '0xvault',
      boringQueue: '0xqueue',
      usdc: '0xusdc',
    },
  },
}));
jest.mock('@/lib/abis/BoringQueue', () => []);
jest.mock('@/constants/tracking-events', () => ({
  TRACKING_EVENTS: {
    WITHDRAW_TRANSACTION_INITIATED: 'withdraw_initiated',
    WITHDRAW_TRANSACTION_COMPLETED: 'withdraw_completed',
    WITHDRAW_TRANSACTION_ERROR: 'withdraw_error',
  },
}));
jest.mock('@/constants/withdraw', () => ({ WITHDRAW_SECONDS_TO_DEADLINE: 3600 }));

const execute = executeTransactions as jest.Mock;
const captureException = Sentry.captureException as jest.Mock;

const receipt = { transactionHash: '0xhash' };

let hook: ReturnType<typeof useWithdraw>;
let root: ReturnType<typeof create>;

function Harness() {
  const result = useWithdraw();
  useEffect(() => {
    hook = result;
  });
  return null;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  execute.mockResolvedValue({ transaction: receipt });
});
afterEach(() => act(() => root?.unmount()));

function mount() {
  return act(() => {
    root = create(<Harness />);
  });
}

it('does not report to Sentry when the user cancels the transaction', async () => {
  execute.mockResolvedValueOnce({ transaction: USER_CANCELLED_TRANSACTION });
  mount();
  await act(async () => {
    await expect(hook.withdraw('100')).rejects.toThrow('User cancelled transaction');
  });
  expect(captureException).not.toHaveBeenCalled();
});

it('reports to Sentry when a real error occurs', async () => {
  execute.mockRejectedValueOnce(new Error('Network failure'));
  mount();
  await act(async () => {
    await expect(hook.withdraw('100')).rejects.toThrow('Network failure');
  });
  expect(captureException).toHaveBeenCalledTimes(1);
  expect(captureException).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Network failure' }),
    expect.objectContaining({ tags: expect.objectContaining({ type: 'withdraw_error' }) }),
  );
});

it('reports to Sentry when executeTransactions returns USER_CANCELLED_TRANSACTION as the raw result', async () => {
  // Direct return (not wrapped in { transaction: ... }) also works
  execute.mockResolvedValueOnce(USER_CANCELLED_TRANSACTION);
  mount();
  await act(async () => {
    await expect(hook.withdraw('100')).rejects.toThrow('User cancelled transaction');
  });
  expect(captureException).not.toHaveBeenCalled();
});
