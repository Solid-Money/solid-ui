import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSafeTokenDeposit } from '@/hooks/useSafeTokenDeposit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/wagmi', () => ({
  publicClient: (chainId: number) => ({
    readContract: (call: unknown) => mockRead(chainId, call),
  }),
}));

const mockRead = jest.fn(async (_chainId: number, _call: unknown): Promise<bigint> => 0n);
const onReceived = jest.fn();
const SAFE = '0x5afe000000000000000000000000000000005afe';
const EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';

type ProbeProps = { enabled?: boolean; token?: string };

let result: ReturnType<typeof useSafeTokenDeposit>;
const Probe = ({ enabled = true, token = EURC }: ProbeProps) => {
  const value = useSafeTokenDeposit({ enabled, chainId: 8453, token, safe: SAFE, onReceived });
  React.useEffect(() => {
    result = value;
  }, [value]);
  return null;
};

let root: any;
let client: QueryClient;
const tree = (props: ProbeProps = {}) => (
  <QueryClientProvider client={client}>
    <Probe {...props} />
  </QueryClientProvider>
);
const mount = (props: ProbeProps = {}) => {
  act(() => {
    root = create(tree(props));
  });
};
/** See the screen's test: the fake clock defers a mid-tick zero-delay notify by 1 ms. */
const flush = async (ms = 0) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms + 1);
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRead.mockReset().mockImplementation(async () => 0n);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root?.unmount());
  client.clear();
  jest.useRealTimers();
});

it('reads the Safe’s balance of the token, and reports a rise above the first read once', async () => {
  mockRead.mockResolvedValueOnce(5n).mockResolvedValue(9n);
  mount();
  await flush();

  expect(result).toEqual({ isWatching: true, isReceived: false });
  expect(mockRead).toHaveBeenCalledWith(
    8453,
    expect.objectContaining({ address: EURC, functionName: 'balanceOf', args: [SAFE] }),
  );

  await flush(6000);

  expect(result.isReceived).toBe(true);
  expect(onReceived).toHaveBeenCalledTimes(1);

  // It stops reading once the deposit is in.
  const reads = mockRead.mock.calls.length;
  await flush(30_000);
  expect(mockRead).toHaveBeenCalledTimes(reads);
  expect(onReceived).toHaveBeenCalledTimes(1);
});

it('counts a deposit after a spend from the lower balance', async () => {
  mockRead.mockResolvedValueOnce(5n).mockResolvedValueOnce(2n).mockResolvedValue(4n);
  mount();
  await flush();
  await flush(6000);

  expect(result.isReceived).toBe(false);

  await flush(6000);

  expect(result.isReceived).toBe(true);
});

it('starts over when the watch ends and starts again', async () => {
  mockRead.mockResolvedValueOnce(5n).mockResolvedValue(9n);
  mount();
  await flush();
  await flush(6000);
  expect(result.isReceived).toBe(true);

  act(() => root.update(tree({ enabled: false })));
  expect(result).toEqual({ isWatching: false, isReceived: false });

  // Shown again: 9 is now where it stands, not a deposit.
  act(() => root.update(tree()));
  await flush();
  await flush(6000);

  expect(result).toEqual({ isWatching: true, isReceived: false });
  expect(onReceived).toHaveBeenCalledTimes(1);
});

it('reads nothing without a token to read', async () => {
  mount({ token: '' });
  await flush(6000);

  expect(result).toEqual({ isWatching: false, isReceived: false });
  expect(mockRead).not.toHaveBeenCalled();
});
