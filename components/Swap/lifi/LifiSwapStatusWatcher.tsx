import { useEffect, useRef } from 'react';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import { fetchLifiSwapStatus } from '@/lib/api/lifi-swap';
import { TransactionStatus } from '@/lib/types';
import { LifiSwapStatus } from '@/lib/types/lifi-swap';
import { withRefreshToken } from '@/lib/utils';
import { isLifiSwapSettled, TrackedLifiSwap, useLifiSwapStore } from '@/store/lifiSwapStore';

const POLL_MS = 15_000;

/** Where LI.FI's outcome leaves the activity row. */
function toActivityStatus(status: LifiSwapStatus): TransactionStatus | undefined {
  if (status.status === 'DONE') {
    return status.substatus === 'REFUNDED' ? TransactionStatus.REFUNDED : TransactionStatus.SUCCESS;
  }
  if (status.status === 'FAILED' || status.status === 'INVALID') return TransactionStatus.FAILED;
  return undefined;
}

/**
 * Follows the signed-in user's cross-chain swaps to delivery and settles their
 * activity rows. Renders nothing; mounted once beside the swap modal, so it
 * keeps polling after the modal closes, and picks up where it left off after a
 * restart from the persisted list.
 */
const LifiSwapStatusWatcher = () => {
  const { user } = useUser();
  const userId = user?.userId;
  const { updateActivity } = useActivityActions();
  const { swaps, update, prune } = useLifiSwapStore(
    useShallow(state => ({
      swaps: state.swaps,
      update: state.actions.update,
      prune: state.actions.prune,
    })),
  );
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    prune();
  }, [prune]);

  // Age alone never stops polling: an unsettled swap is followed until LI.FI
  // resolves it (prune drops one LI.FI never resolves).
  const pending = Object.values(swaps).filter(
    swap => swap.userId === userId && !isLifiSwapSettled(swap),
  );
  const pendingKey = pending.map(swap => swap.clientTxId).join(',');

  useEffect(() => {
    if (!pendingKey) return;

    const poll = async (swap: TrackedLifiSwap) => {
      if (inFlight.current.has(swap.clientTxId)) return;
      inFlight.current.add(swap.clientTxId);
      try {
        const status = (await withRefreshToken(() =>
          fetchLifiSwapStatus({
            txHash: swap.txHash,
            fromChain: swap.fromChainId,
            toChain: swap.toChainId,
          }),
        )) as LifiSwapStatus;

        const delivered =
          status.receivingAmount && status.receivingToken
            ? formatUnits(BigInt(status.receivingAmount), status.receivingToken.decimals)
            : undefined;

        update(swap.clientTxId, {
          status: status.status,
          substatus: status.substatus,
          substatusMessage: status.substatusMessage,
          explorerLink: status.explorerLink,
          receivingTxLink: status.receivingTxLink,
          ...(delivered ? { toAmount: delivered } : {}),
          ...(status.receivingToken ? { toSymbol: status.receivingToken.symbol } : {}),
        });

        const activityStatus = toActivityStatus(status);
        if (activityStatus) {
          updateActivity(swap.clientTxId, {
            status: activityStatus,
            metadata: {
              lifiStatus: status.status,
              lifiSubstatus: status.substatus,
              destinationTxHash: status.receivingTxHash,
              destinationTxLink: status.receivingTxLink,
              lifiExplorerLink: status.explorerLink,
              ...(delivered ? { outputAmount: delivered } : {}),
              ...(status.receivingToken ? { outputToken: status.receivingToken.symbol } : {}),
              settledAt: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        // Transient: the next tick tries again.
        console.warn('[lifi-swap] status check failed', swap.clientTxId, error);
      } finally {
        inFlight.current.delete(swap.clientTxId);
      }
    };

    const tick = () => {
      const current = Object.values(useLifiSwapStore.getState().swaps).filter(
        swap => swap.userId === userId && !isLifiSwapSettled(swap),
      );
      current.forEach(swap => void poll(swap));
    };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [pendingKey, userId, update, updateActivity]);

  return null;
};

export default LifiSwapStatusWatcher;
