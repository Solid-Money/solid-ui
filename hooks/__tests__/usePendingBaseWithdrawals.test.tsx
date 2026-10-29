import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { usePendingBaseWithdrawals } from '@/hooks/useBaseWithdrawRequests';
import { readBaseWithdrawRequest } from '@/lib/soUsdWithdrawStatus';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { useActivityStore } from '@/store/useActivityStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockUser = { userId: 'account', safeAddress: '0xABC' };
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ USER: 'user' }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn() }),
}));
jest.mock('@/constants/withdraw', () => ({ getVaultKey: () => undefined }));
jest.mock('@/lib/soUsdWithdraw', () => ({ isSoUsdBaseConfigured: true }));
jest.mock('@/lib/soUsdWithdrawStatus', () => ({ readBaseWithdrawRequest: jest.fn() }));

const request = (hash: string, timestamp: string): ActivityEvent => ({
  clientTxId: `client-${hash}`,
  hash,
  type: TransactionType.WITHDRAW,
  status: TransactionStatus.SUCCESS,
  amount: '11.057812',
  title: 'Withdraw 11.057812 soUSD',
  timestamp,
  symbol: 'SOUSD',
  chainId: 8453,
});

let result: ReturnType<typeof usePendingBaseWithdrawals>;
function Probe() {
  const value = usePendingBaseWithdrawals();
  React.useEffect(() => {
    result = value;
  }, [value]);
  return null;
}

const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

it('lists the requests still in the queue, newest first, with the USDC they pay out', async () => {
  jest
    .mocked(readBaseWithdrawRequest)
    .mockImplementation(async hash =>
      hash === '0xsolved'
        ? { requestId: '0x01', status: 'finished', amountUsd: 5 }
        : hash === '0xolder'
          ? { requestId: '0x02', status: 'pending', amountUsd: 10.095955 }
          : { requestId: '0x03', status: 'pending', amountUsd: 11.995193 },
    );
  useActivityStore.getState().setEvents(mockUser.userId, [
    request('0xolder', '100'),
    request('0xsolved', '150'),
    request('0xnewer', '200'),
    // Not a Base request: on Ethereum, tracked by the subgraph instead.
    { ...request('0xmainnet', '300'), chainId: 1 },
  ]);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let root: any;
  act(() => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  // Nothing is counted before the queue has been read.
  expect(result.withdrawals).toEqual([]);

  await flush();
  expect(result.withdrawals.map(item => item.clientTxId)).toEqual([
    'client-0xnewer',
    'client-0xolder',
  ]);
  expect(result.totalUsd).toBeCloseTo(11.995193 + 10.095955);
  expect(readBaseWithdrawRequest).not.toHaveBeenCalledWith('0xmainnet');

  act(() => root.unmount());
  client.clear();
});
