import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base, mainnet } from 'viem/chains';

import { WALLET_DEPOSIT_TOKENS } from '@/constants/walletDepositTokens';
import { useDetectedBaseSafeDeposit } from '@/hooks/useDetectedBaseSafeDeposit';
import { fetchActivityEvents } from '@/lib/api';
import {
  type ActivityEvent,
  type ActivityEvents,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { useActivityStore } from '@/store/useActivityStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useUserStore } from '@/store/useUserStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ fetchActivityEvents: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() }),
}));

const USER_ID = 'safe-recipient';
const SAFE = '0x5afe000000000000000000000000000000005afe';
const SENDER = '0x0000000000000000000000000000000000001234';
const OPENED_AT = 1795366200500;
const ACTIVITY_TIME = String(Math.ceil(OPENED_AT / 1000) + 5);
const contract = (symbol: string) =>
  WALLET_DEPOSIT_TOKENS.find(token => token.symbol === symbol)?.contracts[base.id];

const receipt = (overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
  clientTxId: 'base-receipt-1',
  title: 'Receive USDC',
  timestamp: ACTIVITY_TIME,
  type: TransactionType.RECEIVE,
  status: TransactionStatus.SUCCESS,
  amount: '25',
  symbol: 'USDC',
  chainId: base.id,
  hash: '0xtransfer',
  fromAddress: SENDER,
  toAddress: SAFE.toUpperCase(),
  metadata: { tokenAddress: contract('USDC') },
  ...overrides,
});

const activityPage = (docs: ActivityEvent[]): ActivityEvents => ({
  docs,
  hasNextPage: false,
  hasPrevPage: false,
  limit: 30,
  nextPage: null,
  page: 1,
  pagingCounter: 1,
  prevPage: null,
  totalDocs: docs.length,
  totalPages: 1,
});

type WatchProps = Parameters<typeof useDetectedBaseSafeDeposit>[0];
const onDetected = jest.fn();
const fetchPage = jest.mocked(fetchActivityEvents);
let result: ReturnType<typeof useDetectedBaseSafeDeposit>;
let root: any;
let client: QueryClient;
let clock: jest.SpyInstance<number, []>;

const Probe = (props: WatchProps) => {
  const watched = useDetectedBaseSafeDeposit(props);
  React.useEffect(() => {
    result = watched;
  }, [watched]);
  return null;
};

const fixture = (overrides: Partial<WatchProps> = {}) => (
  <QueryClientProvider client={client}>
    <Probe address={SAFE} symbol="USDC" onDetected={onDetected} {...overrides} />
  </QueryClientProvider>
);

const flushQueries = () => act(async () => new Promise(resolve => setTimeout(resolve, 20)));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  useUserStore.setState({
    users: [
      {
        userId: USER_ID,
        safeAddress: SAFE,
        selected: true,
        username: 'recipient',
        signWith: 'test-signer',
        suborgId: 'test-suborg',
      },
    ],
  });
  useActivityStore.setState({ events: {} });
  useRealtimeStore.getState().setStatus('connected');
  fetchPage.mockResolvedValue(activityPage([]));
  clock = jest.spyOn(Date, 'now').mockReturnValue(OPENED_AT);
  client = new QueryClient();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  client.clear();
  clock.mockRestore();
});

it('watches the selected Safe, ignores unrelated receipts, and detects a matching live receipt once', async () => {
  const activity = receipt();
  const unrelated = [
    receipt({ timestamp: String(Math.floor(OPENED_AT / 1000) - 1) }),
    receipt({ chainId: mainnet.id }),
    receipt({ metadata: { tokenAddress: contract('EURC') } }),
    receipt({ toAddress: SENDER }),
    receipt({ fromAddress: SAFE }),
    receipt({ type: TransactionType.SEND }),
    receipt({ status: TransactionStatus.PROCESSING }),
    receipt({ amount: '0' }),
    receipt({ amount: 'invalid' }),
    receipt({ deleted: true }),
    receipt({ metadata: { ...activity.metadata, transferContext: { kind: 'card_refund' } } }),
  ];
  await act(async () => {
    root = create(fixture());
  });
  expect(result).toEqual({ isWatching: true, isDetected: false });

  act(() => useActivityStore.getState().setEvents(USER_ID, unrelated));
  expect(onDetected).not.toHaveBeenCalled();

  act(() => useActivityStore.getState().setEvents(USER_ID, [activity]));
  expect(result.isDetected).toBe(true);
  expect(onDetected).toHaveBeenCalledTimes(1);

  act(() => useActivityStore.getState().setEvents(USER_ID, [{ ...activity, amount: '26' }]));
  expect(onDetected).toHaveBeenCalledTimes(1);
});

it('detects a new receipt in the opening second while ignoring a known confirmed receipt', async () => {
  const timestamp = String(Math.floor(OPENED_AT / 1000));
  const known = receipt({ timestamp });
  useActivityStore.getState().setEvents(USER_ID, [known]);
  fetchPage.mockResolvedValue(activityPage([known]));

  await act(async () => {
    root = create(fixture());
  });
  await flushQueries();
  expect(onDetected).not.toHaveBeenCalled();

  const incoming = receipt({ timestamp, hash: '0xnew', amount: '0.000001' });
  act(() => useActivityStore.getState().setEvents(USER_ID, [incoming, known]));
  expect(onDetected).toHaveBeenCalledTimes(1);
});

it('stores a confirmed EURC receipt found by polling before handing off to Activity', async () => {
  useRealtimeStore.getState().setStatus('unavailable');
  const activity = receipt({ symbol: 'EURC', metadata: { tokenAddress: contract('EURC') } });
  fetchPage.mockResolvedValue(activityPage([activity]));
  onDetected.mockImplementationOnce(() => {
    expect(useActivityStore.getState().events[USER_ID]).toEqual([activity]);
  });

  await act(async () => {
    root = create(fixture({ symbol: 'EURC' }));
  });
  await flushQueries();

  expect(fetchPage).toHaveBeenCalledWith(1);
  expect(onDetected).toHaveBeenCalledTimes(1);
});

it('ignores an in-flight response after the selected token changes', async () => {
  let resolvePage!: (page: ActivityEvents) => void;
  fetchPage.mockReturnValueOnce(
    new Promise(resolve => {
      resolvePage = resolve;
    }),
  );
  await act(async () => {
    root = create(fixture());
  });
  expect(fetchPage).toHaveBeenCalledTimes(1);

  clock.mockReturnValue(OPENED_AT + 1000);
  await act(async () => root.update(fixture({ symbol: 'EURC' })));
  await act(async () => resolvePage(activityPage([receipt()])));
  await flushQueries();

  expect(result).toEqual({ isWatching: true, isDetected: false });
  expect(onDetected).not.toHaveBeenCalled();
  expect(useActivityStore.getState().events[USER_ID]).toBeUndefined();
});

it('does not scan an address different from the selected account’s Safe', async () => {
  await act(async () => {
    root = create(fixture({ address: SENDER }));
  });

  expect(result).toEqual({ isWatching: false, isDetected: false });
  expect(fetchPage).not.toHaveBeenCalled();
});
