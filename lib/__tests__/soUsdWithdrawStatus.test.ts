import { encodeAbiParameters, encodeEventTopics, Hex } from 'viem';

import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { readBaseWithdrawRequest } from '@/lib/soUsdWithdrawStatus';

const QUEUE = '0x204bdC7cc220A743D3b4aC88B2017ccc6b2c21e2';
const OTHER = '0x3c0c8f95D7f4265B2dc5575eBc37a6945c7a7A31';
const USER = '0x0000000000000000000000000000000000005afe';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const REQUEST_ID = `0x${'ab'.repeat(32)}` as Hex;
const TX = `0x${'01'.repeat(32)}` as Hex;

const mockClient = {
  getTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
  getContractEvents: jest.fn(),
};

jest.mock('@/lib/wagmi', () => ({ publicClient: () => mockClient }));
jest.mock('@/lib/config', () => ({
  ADDRESSES: {
    base: {
      boringQueue: '0x204bdC7cc220A743D3b4aC88B2017ccc6b2c21e2',
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
  },
}));

/** The OnChainWithdrawRequested log the queue emits for a request. */
const requestedLog = (address: string, assetOut: string = USDC) => ({
  address,
  topics: encodeEventTopics({
    abi: BoringQueue_ABI,
    eventName: 'OnChainWithdrawRequested',
    args: { requestId: REQUEST_ID, user: USER, assetOut: assetOut as Hex },
  }),
  data: encodeAbiParameters(
    [
      { type: 'uint96' },
      { type: 'uint128' },
      { type: 'uint128' },
      { type: 'uint40' },
      { type: 'uint24' },
      { type: 'uint24' },
    ],
    [1n, 46_193_216n, 49_994_963n, 1_791_454_244, 120, 604_800],
  ),
});

const receiptWith = (...logs: unknown[]) => ({ blockNumber: 52_332_507n, logs });

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(QUEUE)));
  mockClient.readContract.mockResolvedValue([]);
  mockClient.getContractEvents.mockResolvedValue([]);
});

it('is pending while the request is in the queue', async () => {
  mockClient.readContract.mockResolvedValue([`0x${'cd'.repeat(32)}`, REQUEST_ID.toUpperCase()]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'pending',
    amountUsd: 49.994963,
  });
});

it('is finished once the request left the queue', async () => {
  mockClient.readContract.mockResolvedValue([`0x${'cd'.repeat(32)}`]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'finished',
    amountUsd: 49.994963,
  });
});

it('ignores the same event from another contract', async () => {
  mockClient.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(OTHER)));
  await expect(readBaseWithdrawRequest(TX)).resolves.toBeNull();
  expect(mockClient.readContract).not.toHaveBeenCalled();
});

it('leaves the amount unknown when the request asked for something other than USDC', async () => {
  mockClient.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(QUEUE, OTHER)));
  mockClient.readContract.mockResolvedValue([REQUEST_ID]);
  const request = await readBaseWithdrawRequest(TX);
  expect(request).toMatchObject({ requestId: REQUEST_ID, status: 'pending' });
  expect(request?.amountUsd).toBeUndefined();
});

// A stock vault's queue: how a request that left it ended is read from its events.
describe('on a stock vault queue', () => {
  const STOCK_QUEUE = '0xA764c1Ab9A1De069Fc201A209C306337Ed72f7D9';
  const AAPLC = '0xb200000000000000000000C2e324d24d7eEcd1fb';
  const read = () => readBaseWithdrawRequest(TX, STOCK_QUEUE, { readOutcome: true });
  const eventsOf = (cancelled: unknown[], solved: unknown[]) =>
    mockClient.getContractEvents.mockImplementation(async ({ eventName }) =>
      eventName === 'OnChainWithdrawCancelled' ? cancelled : solved,
    );

  beforeEach(() => {
    mockClient.getTransactionReceipt.mockResolvedValue(
      receiptWith(requestedLog(STOCK_QUEUE, AAPLC)),
    );
  });

  it('reads the request from that queue, and is pending while it is there', async () => {
    mockClient.readContract.mockResolvedValue([REQUEST_ID]);
    const request = await read();
    expect(request).toMatchObject({ requestId: REQUEST_ID, status: 'pending' });
    // Not USDC: there is no dollar amount to count while it waits.
    expect(request?.amountUsd).toBeUndefined();
    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: STOCK_QUEUE, functionName: 'getRequestIds' }),
    );
    expect(mockClient.getContractEvents).not.toHaveBeenCalled();
  });

  it('is solved once it left the queue with a solve event', async () => {
    eventsOf([], [{ args: { requestId: REQUEST_ID } }]);
    await expect(read()).resolves.toMatchObject({ status: 'solved' });
    // Looked up by its id, from the block it was made in.
    expect(mockClient.getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        address: STOCK_QUEUE,
        eventName: 'OnChainWithdrawSolved',
        args: { requestId: REQUEST_ID },
        fromBlock: 52_332_507n,
      }),
    );
  });

  // Whoever cancelled it: the user in the app, or the solver after its deadline.
  it('is cancelled once it left the queue with a cancel event', async () => {
    eventsOf([{ args: { requestId: REQUEST_ID } }], []);
    await expect(read()).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('stays finished when the events cannot be read', async () => {
    mockClient.getContractEvents.mockRejectedValue(new Error('block range too wide'));
    await expect(read()).resolves.toMatchObject({ status: 'finished' });
  });

  it('ignores the soUSD queue for a request made on a stock queue', async () => {
    await expect(readBaseWithdrawRequest(TX)).resolves.toBeNull();
  });
});
