import React from 'react';

import { useActivity } from '@/hooks/useActivity';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { useAccountRefreshStore } from '@/store/useAccountRefreshStore';
import { useActivityStore } from '@/store/useActivityStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockUser = { userId: 'account', safeAddress: '0xABC' };
let mockWithdraws: { requestTxHash: string; requestStatus: string }[] | undefined;
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ USER: 'user' }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn() }),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/api', () => ({
  fetchActivityEvents: jest.fn(async () => ({ docs: [], hasNextPage: false })),
}));
jest.mock('@/hooks/useAnalytics', () => ({
  useUserTransactions: () => ({ data: { withdraws: mockWithdraws } }),
}));
jest.mock('@/hooks/useSyncActivities', () => ({
  useSyncActivities: () => ({ isSyncing: false, isStale: false, canSync: true }),
}));
jest.mock('@/hooks/useActivityRefresh', () => ({
  useActivityRefresh: () => ({ refetchAll: jest.fn(), isRefreshing: false }),
}));
jest.mock('@/hooks/useActivityActions', () => ({ useActivityActions: () => ({}) }));
// Base withdraw requests, keyed by request tx hash, as the queue read reports them.
let mockBaseRequests: Record<string, { requestId: string; status: 'pending' | 'finished' }> = {};
jest.mock('@/hooks/useBaseWithdrawRequests', () => ({
  isBaseWithdrawRequest: (activity: {
    type: string;
    chainId?: number;
    status: string;
    hash?: string;
  }) =>
    activity.type === 'withdraw' &&
    activity.chainId === 8453 &&
    activity.status === 'success' &&
    !!activity.hash,
  useBaseWithdrawRequests: () => mockBaseRequests,
}));

const withdrawal: ActivityEvent = {
  clientTxId: 'withdrawal',
  hash: '0xwithdrawal',
  type: TransactionType.WITHDRAW,
  status: TransactionStatus.SUCCESS,
  amount: '10',
  title: 'Withdraw',
  timestamp: '123',
  symbol: 'USDC',
};

describe('Activity withdrawal status freshness', () => {
  let renderer: ReturnType<typeof create>;
  const results: ReturnType<typeof useActivity>[] = [];
  const Probe = () => {
    results.push(useActivity());
    return null;
  };
  beforeEach(() => {
    useActivityStore.setState({ events: { account: [withdrawal] } });
    useAccountRefreshStore.setState({ refreshingByUser: {}, latestPageByUser: {} });
    mockWithdraws = undefined;
    mockBaseRequests = {};
  });
  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('completes a processing row when server fulfillment arrives, without changing the wallet store or navigating', async () => {
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.PROCESSING);
    mockWithdraws = [{ requestTxHash: '0xwithdrawal', requestStatus: 'SOLVED' }];
    await act(async () => {
      renderer.update(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.SUCCESS);
  });

  it('detects a changed older withdrawal beyond the first three rows with an unchanged row count', async () => {
    mockWithdraws = ['first', 'second', 'third', 'withdrawal'].map(id => ({
      requestTxHash: `0x${id}`,
      requestStatus: 'REQUESTED',
    }));
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.PROCESSING);
    mockWithdraws = mockWithdraws.map((row, index) =>
      index === 3 ? { ...row, requestStatus: 'SOLVED' } : row,
    );
    await act(async () => {
      renderer.update(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.SUCCESS);
  });

  describe('a withdrawal on Base, read from the queue', () => {
    const baseWithdrawal: ActivityEvent = { ...withdrawal, hash: '0xbase', chainId: 8453 };
    const userCancel: ActivityEvent = {
      clientTxId: 'cancel',
      type: TransactionType.CANCEL_WITHDRAW,
      status: TransactionStatus.SUCCESS,
      amount: '0',
      title: 'Cancel withdraw',
      timestamp: '124',
      symbol: 'soUSD',
      chainId: 8453,
      metadata: { requestId: '0xREQ' },
    };
    const statusOf = () =>
      results.at(-1)?.activities.find(a => a.clientTxId === 'withdrawal')?.status;

    it('is processing until the queue has been read, and ignores the mainnet subgraph', async () => {
      useActivityStore.setState({ events: { account: [baseWithdrawal] } });
      mockWithdraws = [{ requestTxHash: '0xbase', requestStatus: 'SOLVED' }];
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(statusOf()).toBe(TransactionStatus.PROCESSING);
    });

    it('is processing while the request is in the queue, with its id for a cancel', async () => {
      useActivityStore.setState({ events: { account: [baseWithdrawal] } });
      mockBaseRequests = { '0xbase': { requestId: '0xreq', status: 'pending' } };
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(statusOf()).toBe(TransactionStatus.PROCESSING);
      expect(results.at(-1)?.activities.find(a => a.clientTxId === 'withdrawal')?.requestId).toBe(
        '0xreq',
      );
    });

    it('is a success once it left the queue', async () => {
      useActivityStore.setState({ events: { account: [baseWithdrawal] } });
      mockBaseRequests = { '0xbase': { requestId: '0xreq', status: 'finished' } };
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(statusOf()).toBe(TransactionStatus.SUCCESS);
    });

    it('is cancelled once it left the queue after the user cancelled it', async () => {
      useActivityStore.setState({ events: { account: [baseWithdrawal, userCancel] } });
      mockBaseRequests = { '0xbase': { requestId: '0xreq', status: 'finished' } };
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(statusOf()).toBe(TransactionStatus.CANCELLED);
    });
  });
});
