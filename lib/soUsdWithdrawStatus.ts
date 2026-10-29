import { decodeEventLog, formatUnits, Hex, isAddressEqual } from 'viem';
import { base } from 'viem/chains';

import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

/**
 * Where a soUSD withdraw request on the Base queue stands.
 *
 * The mainnet queue's requests are tracked by the subgraph. Base has none, so
 * this reads the queue itself: a request is pending while its id is still in
 * the queue's outstanding set, and finished once it left it.
 *
 * The queue records nothing more: a solve and a cancel both just remove the id.
 * Finished therefore means solved or cancelled, and the caller tells them apart
 * from the user's own cancel activity. A request the solver cancels after its
 * deadline has no such activity, so it reads as solved.
 */
export type BaseWithdrawRequestStatus = 'pending' | 'finished';

export type BaseWithdrawRequest = {
  requestId: Hex;
  status: BaseWithdrawRequestStatus;
  /**
   * The USDC the request pays out, fixed when it was made. Undefined if it asked
   * for another asset. A plain number so the query stays JSON-safe.
   */
  amountUsd?: number;
};

/** Base USDC, the only asset the app asks the Base queue for. */
const USDC_DECIMALS = 6;

/**
 * The request a withdraw transaction made on the Base queue, and its status.
 *
 * Returns null when the transaction made no request on the Base queue.
 */
export async function readBaseWithdrawRequest(
  requestTxHash: Hex,
): Promise<BaseWithdrawRequest | null> {
  const client = publicClient(base.id);
  const queue = ADDRESSES.base.boringQueue;

  const receipt = await client.getTransactionReceipt({ hash: requestTxHash });
  let requestId: Hex | undefined;
  let amountUsd: number | undefined;
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, queue)) continue;
    try {
      const event = decodeEventLog({ abi: BoringQueue_ABI, data: log.data, topics: log.topics });
      if (event.eventName === 'OnChainWithdrawRequested') {
        requestId = event.args.requestId;
        if (isAddressEqual(event.args.assetOut, ADDRESSES.base.usdc)) {
          amountUsd = Number(formatUnits(event.args.amountOfAssets, USDC_DECIMALS));
        }
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
  const isPending = outstanding.some(id => id.toLowerCase() === requestId.toLowerCase());
  return { requestId, status: isPending ? 'pending' : 'finished', amountUsd };
}
