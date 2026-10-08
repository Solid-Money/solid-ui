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
};

jest.mock('@/lib/wagmi', () => ({ publicClient: () => mockClient }));
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
  mockClient.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(QUEUE)));
  mockClient.readContract.mockResolvedValue([]);
});

it('is pending while the request is in the queue', async () => {
  mockClient.readContract.mockResolvedValue([`0x${'cd'.repeat(32)}`, REQUEST_ID.toUpperCase()]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'pending',
  });
});

it('is finished once the request left the queue', async () => {
  mockClient.readContract.mockResolvedValue([`0x${'cd'.repeat(32)}`]);
  await expect(readBaseWithdrawRequest(TX)).resolves.toEqual({
    requestId: REQUEST_ID,
    status: 'finished',
  });
});

it('ignores the same event from another contract', async () => {
  mockClient.getTransactionReceipt.mockResolvedValue(receiptWith(requestedLog(OTHER)));
  await expect(readBaseWithdrawRequest(TX)).resolves.toBeNull();
  expect(mockClient.readContract).not.toHaveBeenCalled();
});
