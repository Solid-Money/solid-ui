import { encodeAbiParameters, encodeEventTopics, Hex, toEventSelector } from 'viem';

import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { readBaseWithdrawRequest } from '@/lib/soUsdWithdrawStatus';

const QUEUE = '0x204bdC7cc220A743D3b4aC88B2017ccc6b2c21e2';
const OTHER = '0x3c0c8f95D7f4265B2dc5575eBc37a6945c7a7A31';
const USER = '0x0000000000000000000000000000000000005afe';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const REQUEST_ID = `0x${'ab'.repeat(32)}` as Hex;
const TX = `0x${'01'.repeat(32)}` as Hex;
const SOLVED = toEventSelector('OnChainWithdrawSolved(bytes32,address,uint256)');
const CANCELLED = toEventSelector('OnChainWithdrawCancelled(bytes32,address,uint256)');

const client = {
  getTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
  request: jest.fn(),
};

jest.mock('@/lib/wagmi', () => ({ publicClient: () => client }));
jest.mock('@/lib/config', () => ({
  ADDRESSES: { base: { boringQueue: '0x204bdC7cc220A743D3b4aC88B2017ccc6b2c21e2' } },
}));

/** The OnChainWithdrawRequested log the queue emits for a request. */
const requestedLog = (address: string) => ({
  address,
  topics: encodeEventTopics({
    abi: BoringQueue_ABI,
    eventName: 'OnChainWithdrawRequested',
    args: { requestId: REQUEST_ID, user: USER, assetOut: USDC },
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
  client.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(QUEUE)));
  client.readContract.mockResolvedValue([]);
  client.request.mockResolvedValue([]);
});

it('is pending while the request is in the queue', async () => {
  client.readContract.mockResolvedValue([`0x${'cd'.repeat(32)}`, REQUEST_ID.toUpperCase()]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'pending',
  });
  expect(client.request).not.toHaveBeenCalled();
});

it('is solved once it left the queue with a solve event', async () => {
  client.request.mockResolvedValue([{ topics: [SOLVED, REQUEST_ID] }]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'solved',
  });
  // Searched from the request's own block, for either outcome of this request only.
  expect(client.request).toHaveBeenCalledWith({
    method: 'eth_getLogs',
    params: [
      {
        address: QUEUE,
        fromBlock: '0x31e87db',
        toBlock: 'latest',
        topics: [[SOLVED, CANCELLED], REQUEST_ID],
      },
    ],
  });
});

it('is cancelled once it left the queue with a cancel event', async () => {
  client.request.mockResolvedValue([{ topics: [CANCELLED, REQUEST_ID] }]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'cancelled',
  });
});

it('throws rather than guess when the request left the queue without a trace', async () => {
  await expect(readBaseWithdrawRequest(TX)).rejects.toThrow(/no solve or cancel/);
});

it('ignores the same event from another contract', async () => {
  client.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(OTHER)));
  await expect(readBaseWithdrawRequest(TX)).resolves.toBeNull();
  expect(client.readContract).not.toHaveBeenCalled();
});
