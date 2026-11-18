import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAllowAiApiCharges } from '@/hooks/useAiApi';
import { confirmAiApiBilling } from '@/lib/api/ai-api';
import { executeTransactions } from '@/lib/execute';
import { publicClient } from '@/lib/wagmi';

const { act, create } = jest.requireActual('react-test-renderer');

const SAFE = '0xefca7E3C3E10F4523aE4D0203e6A98B9776F0291';
const MODULE = '0xFfadC8fD07743043fc751024e781f126Ddd20315';

const mockSafeAA = jest.fn(async () => ({ account: { address: SAFE } }));

jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/errors', () => ({ showErrorToast: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/api/ai-api', () => ({ confirmAiApiBilling: jest.fn() }));
jest.mock('@/lib/execute', () => ({
  executeTransactions: jest.fn(),
  USER_CANCELLED_TRANSACTION: Symbol('cancel'),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: { userId: 'user-1', safeAddress: SAFE, suborgId: 'org-1', signWith: '0xsigner' },
    safeAA: mockSafeAA,
  }),
}));
jest.mock('@/store/useUserStore', () => {
  const state = { users: [{ userId: 'user-1', selected: true }] };
  const useUserStore = (selector: (value: typeof state) => unknown) => selector(state);
  useUserStore.getState = () => state;
  return { useUserStore };
});

const getCode = jest.fn();
const readContract = jest.fn();
const execute = jest.mocked(executeTransactions);

let client: QueryClient;
let root: any;
let hook: ReturnType<typeof useAllowAiApiCharges>;

function Probe() {
  const value = useAllowAiApiCharges();
  React.useEffect(() => {
    hook = value;
  });
  return null;
}

const allow = () =>
  hook.allow({
    requiredMandateUsd: 50,
    moduleAddress: MODULE,
    periodSeconds: 86400,
    chainId: 8453,
  });

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(publicClient).mockReturnValue({ getCode, readContract } as any);
  execute.mockResolvedValue({ transactionHash: '0xhash' } as any);
  jest.mocked(confirmAiApiBilling).mockResolvedValue({} as any);
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
});

it('enables the module on a Wallet whose Safe is not deployed on Base yet', async () => {
  // A Safe with no code: asking it isModuleEnabled would fail, so it isn't asked.
  getCode.mockResolvedValue('0x');

  await act(async () => {
    await expect(allow()).resolves.toBe(true);
  });

  expect(readContract).not.toHaveBeenCalled();
  const [, transactions] = execute.mock.calls[0];
  expect(transactions).toHaveLength(2);
  expect(transactions[0].to).toBe(SAFE);
  expect(transactions[1].to).toBe(MODULE);
  expect(confirmAiApiBilling).toHaveBeenCalledWith({ transactionHash: '0xhash' });
});

it('only writes the mandate when the deployed Safe already has the module', async () => {
  getCode.mockResolvedValue('0x6080');
  readContract.mockResolvedValue(true);

  await act(async () => {
    await expect(allow()).resolves.toBe(true);
  });

  const [, transactions] = execute.mock.calls[0];
  expect(transactions).toHaveLength(1);
  expect(transactions[0].to).toBe(MODULE);
});

it('stops when the Safe can’t be read', async () => {
  getCode.mockRejectedValue(new Error('rpc down'));

  await act(async () => {
    await expect(allow()).rejects.toThrow('Couldn’t check your wallet. Please try again.');
  });

  expect(execute).not.toHaveBeenCalled();
});
