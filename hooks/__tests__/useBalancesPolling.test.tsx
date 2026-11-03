import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  BALANCES_LIVE_POLL_MS,
  BALANCES_POLL_MS,
  useBalances,
  useBalancesPolling,
} from '@/hooks/useBalances';
import { fetchTokenBalancesWithFallback } from '@/lib/data-source';
import { useRealtimeStore } from '@/store/useRealtimeStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const SAFE = '0x1111111111111111111111111111111111111111';

// The real modules reach native storage; only these pure checks are read here.
jest.mock('@/lib/utils', () => ({
  isSoETHToken: () => false,
  isSoEURCToken: () => false,
  isSoFUSEToken: () => false,
  isSoUSDToken: () => false,
  isWalletCardExcludedToken: () => false,
}));
jest.mock('@/constants/walletDepositTokens', () => ({
  isWalletDepositContract: () => false,
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { safeAddress: '0x1111111111111111111111111111111111111111' } }),
}));
jest.mock('@/lib/data-source', () => ({
  fetchTokenBalancesWithFallback: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/api', () => ({
  fetchCoinPricesById: jest.fn().mockResolvedValue({}),
  fetchTokenList: jest.fn().mockResolvedValue([]),
  fetchTokenPricesByAddress: jest.fn().mockResolvedValue({}),
  fetchTokenPricesBySymbol: jest.fn().mockResolvedValue({}),
  fetchTokenPriceUsd: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn(() => ({})) }));
// The real list pulls in token artwork (and Reanimated with it); only the
// native ids are read here.
jest.mock('@/constants/tokens', () => ({
  NATIVE_COINGECKO_TOKENS: {},
  NATIVE_TOKENS: {},
}));
jest.mock('viem/actions', () => ({
  getBalance: jest.fn().mockResolvedValue(0n),
  readContract: jest.fn().mockResolvedValue(0n),
}));

/** One balance refresh reads the token list of all seven chains. */
const CHAINS_PER_REFRESH = 7;
const mockFetchChain = fetchTokenBalancesWithFallback as jest.MockedFunction<
  typeof fetchTokenBalancesWithFallback
>;
const refreshes = () => mockFetchChain.mock.calls.length / CHAINS_PER_REFRESH;

/** Let the refresh started by a timer run to the end. */
const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await settle();
};

/** Screens that show a balance; none of them polls. */
const Screen = () => {
  useBalances();
  return null;
};

const Layout = () => {
  useBalancesPolling();
  return null;
};

/** How far apart the screens mount: out of step, as screens open in the app. */
const SCREEN_MOUNT_GAP_MS = 4_000;

/**
 * The layout's poller, then three screens a few seconds apart. Timers started
 * at the same instant would fire together and share one refresh, hiding a
 * per-screen poll; staggered ones would not.
 */
const mount = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const roots: any[] = [];
  const render = async (node: React.ReactElement) => {
    await act(async () => {
      roots.push(create(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
    });
    await settle();
  };
  await render(<Layout />);
  for (let i = 0; i < 3; i++) {
    await render(<Screen />);
    await act(async () => {
      jest.advanceTimersByTime(SCREEN_MOUNT_GAP_MS);
    });
    await settle();
  }
  const mountRefreshes = refreshes();
  mockFetchChain.mockClear();
  return {
    client,
    mountRefreshes,
    root: {
      unmount: () => roots.forEach(root => root.unmount()),
    },
  };
};

/**
 * The app's Alchemy bill scaled with this poll: every refresh reads six
 * Alchemy chains, and each component that showed a balance used to run its
 * own 5s timer. One timer now, slowed while the realtime socket is live.
 */
describe('balance polling', () => {
  let mounted: Awaited<ReturnType<typeof mount>> | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchChain.mockClear();
  });

  afterEach(async () => {
    if (mounted) {
      const { root, client } = mounted;
      await act(async () => {
        root.unmount();
      });
      client.clear();
      mounted = undefined;
    }
    jest.useRealTimers();
    useRealtimeStore.getState().setStatus('idle');
  });

  /**
   * Advance `steps` intervals in 5s steps, letting each refresh finish, so a
   * faster timer (a per-screen 5s poll) would show up as extra refreshes
   * rather than joining one in flight. A window of whole intervals holds
   * exactly one tick of the poller per interval, whatever its phase.
   */
  const pollFor = async (steps: number, intervalMs: number) => {
    for (let elapsed = 0; elapsed < steps * intervalMs; elapsed += 5_000) {
      await advance(5_000);
    }
  };

  it('reads the chains once on mount, however many screens show a balance', async () => {
    mounted = await mount();
    expect(mounted.mountRefreshes).toBe(1);
    await advance(0);
    expect(mockFetchChain).not.toHaveBeenCalled();
  });

  it('polls once a minute while the realtime socket is live, not once per screen', async () => {
    useRealtimeStore.getState().setStatus('connected');
    mounted = await mount();

    await pollFor(5, BALANCES_LIVE_POLL_MS);

    expect(refreshes()).toBe(5);
    expect(mockFetchChain).toHaveBeenCalledWith(8453, SAFE);
  });

  it('polls every 15s while the socket is down, still once per interval', async () => {
    useRealtimeStore.getState().setStatus('unavailable');
    mounted = await mount();

    await pollFor(8, BALANCES_POLL_MS);

    expect(refreshes()).toBe(8);
  });

  it('speeds up as soon as the socket goes down', async () => {
    useRealtimeStore.getState().setStatus('connected');
    mounted = await mount();

    await act(async () => {
      useRealtimeStore.getState().setStatus('unavailable');
    });
    await pollFor(4, BALANCES_POLL_MS);

    expect(refreshes()).toBe(4);
  });

  it('slows down as soon as the socket comes up', async () => {
    useRealtimeStore.getState().setStatus('unavailable');
    mounted = await mount();

    await act(async () => {
      useRealtimeStore.getState().setStatus('connected');
    });
    await pollFor(3, BALANCES_POLL_MS);
    expect(refreshes()).toBe(0);

    await pollFor(1, BALANCES_POLL_MS);
    expect(refreshes()).toBe(1);
  });
});
