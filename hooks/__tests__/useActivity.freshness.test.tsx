import React from 'react';

import { useActivity } from '@/hooks/useActivity';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { useAccountRefreshStore } from '@/store/useAccountRefreshStore';
import { useActivityStore } from '@/store/useActivityStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockUser = { userId: 'account', safeAddress: '0xABC' };
type MockWithdraw = { requestTxHash: string; requestStatus: string; requestId?: string };
let mockWithdraws: MockWithdraw[] | undefined;
let mockEurWithdraws: MockWithdraw[] | undefined;
let mockEthWithdraws: MockWithdraw[] | undefined;
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ USER: 'user', isDevFeatureEnabled: true }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn() }),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/api', () => ({
  fetchActivityEvents: jest.fn(async () => ({ docs: [], hasNextPage: false })),
}));
jest.mock('@/hooks/useAnalytics', () => ({
  // The USD subgraph by default; each other vault's own when asked for it.
  useUserTransactions: (_address: string, vault?: string) => ({
    data: {
      withdraws:
        vault === 'eur'
          ? mockEurWithdraws
          : vault === 'eth'
            ? mockEthWithdraws
            : vault === 'fuse'
              ? undefined
              : mockWithdraws,
    },
  }),
}));
jest.mock('@/hooks/useSyncActivities', () => ({
  useSyncActivities: () => ({ isSyncing: false, isStale: false, canSync: true }),
}));
jest.mock('@/hooks/useActivityRefresh', () => ({
  useActivityRefresh: () => ({ refetchAll: jest.fn(), isRefreshing: false }),
}));
jest.mock('@/hooks/useActivityActions', () => ({ useActivityActions: () => ({}) }));
let mockListedTokens: ReadonlySet<string> | null = null;
jest.mock('@/hooks/useListedTokens', () => ({ useListedTokens: () => mockListedTokens }));
// Base withdraw requests, keyed by request tx hash, as the queue read reports them.
let mockBaseRequests: Record<
  string,
  { requestId: string; status: 'pending' | 'finished' | 'solved' | 'cancelled' }
> = {};
// Whether this build has the stocks subgraph, and what it holds.
let mockHasStockSubgraph = false;
let mockStockWithdraws: (MockWithdraw & { vault: { id: string } })[] | undefined;
jest.mock('@/hooks/useBaseWithdrawRequests', () => ({
  // As the real one: soUSD's, and a stock vault's without the stocks subgraph — never
  // soEURC's, which withdraws on Base through its own queue.
  isBaseWithdrawRequest: (activity: {
    type: string;
    chainId?: number;
    status: string;
    hash?: string;
    symbol?: string;
  }) =>
    activity.type === 'withdraw' &&
    activity.chainId === 8453 &&
    !['soeurc', 'soeur'].includes(activity.symbol?.toLowerCase() ?? '') &&
    !(mockHasStockSubgraph && activity.symbol?.toLowerCase() === 'soaapl') &&
    activity.status === 'success' &&
    !!activity.hash,
  useBaseWithdrawRequests: () => mockBaseRequests,
}));
jest.mock('@/hooks/useStockVaultTransactions', () => ({
  useStockVaultTransactions: (address: string | undefined) => ({
    data:
      address && mockHasStockSubgraph ? { deposits: [], withdraws: mockStockWithdraws } : undefined,
  }),
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
    mockListedTokens = null;
    mockBaseRequests = {};
    mockEurWithdraws = undefined;
    mockEthWithdraws = undefined;
    mockHasStockSubgraph = false;
    mockStockWithdraws = undefined;
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

  it('hides a cached receive of a token that is not on the list, and only that', async () => {
    const receive = (clientTxId: string, tokenAddress: string, symbol: string): ActivityEvent => ({
      clientTxId,
      type: TransactionType.RECEIVE,
      status: TransactionStatus.SUCCESS,
      amount: '10',
      title: `Receive ${symbol}`,
      timestamp: '200',
      symbol,
      chainId: 8453,
      metadata: { source: 'blockscout', tokenAddress },
    });
    useActivityStore.setState({
      events: {
        account: [
          withdrawal,
          receive('spam', '0xba42a3f0b0dbadeeaa974c1d30dd46abc7845468', 'ZORRA'),
          receive('usdc', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC'),
        ],
      },
    });
    mockListedTokens = new Set(['8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913']);

    await act(async () => {
      renderer = create(<Probe />);
    });

    expect(results.at(-1)?.activities.map(activity => activity.clientTxId)).toEqual([
      'usdc',
      'withdrawal',
    ]);
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

  // A soEURC request sits on the soEURC queue: only the EUR subgraph can say it
  // was solved, never a USD row that happens to share its hash.
  it('resolves a soEURC withdrawal from the EUR subgraph only', async () => {
    useActivityStore.setState({
      events: { account: [{ ...withdrawal, symbol: 'soEURC', hash: '0xeur' }] },
    });
    mockWithdraws = [{ requestTxHash: '0xeur', requestStatus: 'SOLVED' }];
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.PROCESSING);

    mockEurWithdraws = [{ requestTxHash: '0xeur', requestStatus: 'SOLVED' }];
    await act(async () => {
      renderer.update(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.SUCCESS);
  });

  // soEURC withdraws on Base too, but not through soUSD's Base queue: a Base soEURC
  // request is never read from that queue, and resolves from the EUR subgraph.
  it('resolves a soEURC withdrawal on Base from the EUR subgraph, not the soUSD queue', async () => {
    useActivityStore.setState({
      events: { account: [{ ...withdrawal, symbol: 'soEURC', hash: '0xeur', chainId: 8453 }] },
    });
    mockBaseRequests = { '0xeur': { requestId: '0xreq', status: 'finished' } };
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.PROCESSING);

    mockEurWithdraws = [{ requestTxHash: '0xeur', requestStatus: 'SOLVED' }];
    await act(async () => {
      renderer.update(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.SUCCESS);
  });

  // soETH requests sit on the soETH queue: only its own subgraph can say one was solved.
  it('resolves a soETH withdrawal from the soETH subgraph, not the USD one', async () => {
    useActivityStore.setState({
      events: { account: [{ ...withdrawal, symbol: 'soETH', hash: '0xeth', chainId: 1 }] },
    });
    mockWithdraws = [{ requestTxHash: '0xeth', requestStatus: 'SOLVED' }];
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.PROCESSING);

    mockEthWithdraws = [{ requestTxHash: '0xeth', requestStatus: 'SOLVED', requestId: '0xreq' }];
    await act(async () => {
      renderer.update(<Probe />);
    });
    expect(results.at(-1)?.activities[0].status).toBe(TransactionStatus.SUCCESS);
  });

  describe('a soEURC withdrawal in the EUR subgraph', () => {
    const eurWithdrawal: ActivityEvent = {
      ...withdrawal,
      symbol: 'soEURC',
      hash: '0xeur',
      chainId: 8453,
    };
    const eurOf = () => results.at(-1)?.activities.find(a => a.clientTxId === 'withdrawal');

    it('is processing while queued, with its request id for a cancel', async () => {
      useActivityStore.setState({ events: { account: [eurWithdrawal] } });
      mockEurWithdraws = [{ requestTxHash: '0xeur', requestStatus: 'PENDING', requestId: '0xreq' }];
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(eurOf()?.status).toBe(TransactionStatus.PROCESSING);
      expect(eurOf()?.requestId).toBe('0xreq');
    });

    it('is cancelled once the subgraph says so', async () => {
      useActivityStore.setState({ events: { account: [eurWithdrawal] } });
      mockEurWithdraws = [
        { requestTxHash: '0xeur', requestStatus: 'CANCELLED', requestId: '0xreq' },
      ];
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(eurOf()?.status).toBe(TransactionStatus.CANCELLED);
    });

    it('is cancelled as soon as the user cancels it, before the subgraph indexes it', async () => {
      useActivityStore.setState({
        events: {
          account: [
            eurWithdrawal,
            {
              clientTxId: 'cancel',
              type: TransactionType.CANCEL_WITHDRAW,
              status: TransactionStatus.SUCCESS,
              amount: '0',
              title: 'Cancel withdraw',
              timestamp: '124',
              symbol: 'soEURC',
              chainId: 8453,
              metadata: { requestId: '0xREQ' },
            },
          ],
        },
      });
      mockEurWithdraws = [{ requestTxHash: '0xeur', requestStatus: 'PENDING', requestId: '0xreq' }];
      await act(async () => {
        renderer = create(<Probe />);
      });
      expect(eurOf()?.status).toBe(TransactionStatus.CANCELLED);
    });
  });

  describe('a stock vault withdrawal', () => {
    // soAAPL's vault, which the stocks subgraph names on every row.
    const SOAAPL_VAULT = '0xbfe0bf0097d9ab28928ecacda3e33366b36517cd';
    const stockWithdrawal: ActivityEvent = {
      ...withdrawal,
      symbol: 'soAAPL',
      hash: '0xaapl',
      chainId: 8453,
    };
    const stockOf = () => results.at(-1)?.activities.find(a => a.clientTxId === 'withdrawal');

    describe('without the stocks subgraph, read from its queue', () => {
      it('is processing while queued, with its request id for a cancel', async () => {
        useActivityStore.setState({ events: { account: [stockWithdrawal] } });
        mockBaseRequests = { '0xaapl': { requestId: '0xreq', status: 'pending' } };
        await act(async () => {
          renderer = create(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.PROCESSING);
        expect(stockOf()?.requestId).toBe('0xreq');
      });

      it('is a success once the queue says it was solved', async () => {
        useActivityStore.setState({ events: { account: [stockWithdrawal] } });
        mockBaseRequests = { '0xaapl': { requestId: '0xreq', status: 'solved' } };
        await act(async () => {
          renderer = create(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.SUCCESS);
      });

      // Without a cancel activity of the user's own: the queue's event is enough.
      it('is cancelled once the queue says it was cancelled', async () => {
        useActivityStore.setState({ events: { account: [stockWithdrawal] } });
        mockBaseRequests = { '0xaapl': { requestId: '0xreq', status: 'cancelled' } };
        await act(async () => {
          renderer = create(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.CANCELLED);
      });
    });

    describe('with the stocks subgraph', () => {
      beforeEach(() => {
        mockHasStockSubgraph = true;
      });

      it('resolves from its own vault rows, never the USD subgraph or the queue', async () => {
        useActivityStore.setState({ events: { account: [stockWithdrawal] } });
        mockWithdraws = [{ requestTxHash: '0xaapl', requestStatus: 'SOLVED' }];
        mockBaseRequests = { '0xaapl': { requestId: '0xreq', status: 'solved' } };
        // Another stock vault's row with the same hash does not count.
        mockStockWithdraws = [
          {
            requestTxHash: '0xaapl',
            requestStatus: 'SOLVED',
            vault: { id: '0xother' },
            requestId: '0x1',
          },
        ];
        await act(async () => {
          renderer = create(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.PROCESSING);

        mockStockWithdraws = [
          {
            requestTxHash: '0xaapl',
            requestStatus: 'PENDING',
            vault: { id: SOAAPL_VAULT },
            requestId: '0xreq',
          },
        ];
        await act(async () => {
          renderer.update(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.PROCESSING);
        expect(stockOf()?.requestId).toBe('0xreq');

        mockStockWithdraws = [
          {
            requestTxHash: '0xaapl',
            requestStatus: 'SOLVED',
            vault: { id: SOAAPL_VAULT },
            requestId: '0xreq',
          },
        ];
        await act(async () => {
          renderer.update(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.SUCCESS);
      });

      it('is cancelled once the subgraph says so', async () => {
        useActivityStore.setState({ events: { account: [stockWithdrawal] } });
        mockStockWithdraws = [
          {
            requestTxHash: '0xaapl',
            requestStatus: 'CANCELLED',
            vault: { id: SOAAPL_VAULT },
            requestId: '0xreq',
          },
        ];
        await act(async () => {
          renderer = create(<Probe />);
        });
        expect(stockOf()?.status).toBe(TransactionStatus.CANCELLED);
      });
    });
  });
});
