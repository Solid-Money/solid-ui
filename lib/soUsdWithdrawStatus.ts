import { decodeEventLog, Hex, isAddressEqual, toEventSelector, toHex } from 'viem';
import { base } from 'viem/chains';

import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

/**
 * Where a soUSD withdraw request on the Base queue stands.
 *
 * The mainnet queue's requests are tracked by the subgraph. Base has none, so
 * this reads the queue itself: a request is pending while its id is still in
 * the queue's outstanding set, and leaves that set when it is solved or
 * cancelled. The queue keeps no record of which, so that comes from the event
 * the solve or cancel emitted.
 */
export type BaseWithdrawRequestStatus = 'pending' | 'solved' | 'cancelled';

export type BaseWithdrawRequest = {
  requestId: Hex;
  status: BaseWithdrawRequestStatus;
};

const SOLVED_TOPIC = toEventSelector('OnChainWithdrawSolved(bytes32,address,uint256)');
const CANCELLED_TOPIC = toEventSelector('OnChainWithdrawCancelled(bytes32,address,uint256)');

/**
 * The request a withdraw transaction made on the Base queue, and its status.
 *
 * Returns null when the transaction made no request on the Base queue. Throws
 * when the status cannot be read, so a caller keeps showing the request as in
 * progress rather than guessing it finished.
 */
export async function readBaseWithdrawRequest(
  requestTxHash: Hex,
): Promise<BaseWithdrawRequest | null> {
  const client = publicClient(base.id);
  const queue = ADDRESSES.base.boringQueue;

  const receipt = await client.getTransactionReceipt({ hash: requestTxHash });
  let requestId: Hex | undefined;
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, queue)) continue;
    try {
      const event = decodeEventLog({ abi: BoringQueue_ABI, data: log.data, topics: log.topics });
      if (event.eventName === 'OnChainWithdrawRequested') {
        requestId = event.args.requestId;
        break;
      }
    } catch {
      // Another queue event (e.g. the share transfer's); keep looking.
    }
  }
  if (!requestId) return null;

  const outstanding = await client.readContract({
    address: queue,
    abi: BoringQueue_ABI,
    functionName: 'getRequestIds',
  });
  if (outstanding.some(id => id.toLowerCase() === requestId.toLowerCase())) {
    return { requestId, status: 'pending' };
  }

  // Both events index the request id first, so one filter finds whichever was
  // emitted. Nothing can happen to the request before the block it was made in.
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [
      {
        address: queue,
        fromBlock: toHex(receipt.blockNumber),
        toBlock: 'latest',
        topics: [[SOLVED_TOPIC, CANCELLED_TOPIC], requestId],
      },
    ],
  });
  const outcome = logs[0]?.topics[0];
  if (outcome === SOLVED_TOPIC) return { requestId, status: 'solved' };
  if (outcome === CANCELLED_TOPIC) return { requestId, status: 'cancelled' };
  throw new Error(`Request ${requestId} left the Base queue but no solve or cancel was found`);
}
