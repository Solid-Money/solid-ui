import { Address, decodeEventLog, formatUnits, Hex, isAddressEqual } from 'viem';
import { base } from 'viem/chains';

import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

/**
 * Where a withdraw request on a Base queue stands: soUSD's, or a stock vault's.
 *
 * The mainnet queue's requests are tracked by the subgraph. Base has none, so
 * this reads the queue itself: a request is pending while its id is still in
 * the queue's outstanding set, and finished once it left it.
 *
 * The outstanding set records nothing more: a solve and a cancel both just remove
 * the id. Finished therefore means solved or cancelled, and for soUSD the caller
 * tells them apart from the user's own cancel activity — a request the solver
 * cancels after its deadline has no such activity, so it reads as solved.
 *
 * A stock vault's request is told apart on chain instead (`readOutcome`): the queue
 * emits `OnChainWithdrawSolved` or `OnChainWithdrawCancelled` with the request id,
 * once, so a finished request is looked up in those logs. Should the lookup fail
 * (an RPC that limits log ranges), it stays `finished`, read as soUSD's is.
 */
export type BaseWithdrawRequestStatus = 'pending' | 'finished' | 'solved' | 'cancelled';

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
 * How a request that left `queue` ended: solved or cancelled, read from the queue's
 * own events from the block it was made in. `finished` when neither is found or the
 * logs cannot be read.
 */
async function readFinishedOutcome(
  queue: Address,
  requestId: Hex,
  fromBlock: bigint,
): Promise<BaseWithdrawRequestStatus> {
  const client = publicClient(base.id);
  try {
    const [cancelled, solved] = await Promise.all(
      (['OnChainWithdrawCancelled', 'OnChainWithdrawSolved'] as const).map(eventName =>
        client.getContractEvents({
          address: queue,
          abi: BoringQueue_ABI,
          eventName,
          args: { requestId },
          fromBlock,
        }),
      ),
    );
    if (cancelled.length > 0) return 'cancelled';
    if (solved.length > 0) return 'solved';
  } catch (error) {
    console.warn('Could not read how a Base withdraw request ended:', error);
  }
  return 'finished';
}

/**
 * The request a withdraw transaction made on a Base queue — soUSD's unless another
 * is named — and its status. `readOutcome` resolves a finished request to solved or
 * cancelled from the queue's events (see {@link BaseWithdrawRequestStatus}).
 *
 * Returns null when the transaction made no request on that queue.
 */
export async function readBaseWithdrawRequest(
  requestTxHash: Hex,
  queue: Address = ADDRESSES.base.boringQueue,
  { readOutcome = false }: { readOutcome?: boolean } = {},
): Promise<BaseWithdrawRequest | null> {
  const client = publicClient(base.id);

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
  const status = isPending
    ? 'pending'
    : readOutcome
      ? await readFinishedOutcome(queue, requestId, receipt.blockNumber)
      : 'finished';
  return { requestId, status, amountUsd };
}
