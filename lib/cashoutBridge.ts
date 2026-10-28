import { formatLD } from '@/lib/utils/cross-chain-send';

import type { CrossChainSendQuote } from '@/lib/types/cross-chain-send';

/**
 * Topping up a cash-out from Fuse.
 *
 * A cash-out sends USDC on Base. When the Base balance is short, the rest comes
 * from the user's USDC on Fuse, moved first through the cross-chain send to
 * their own wallet on Base. Only once it has landed is the order opened and the
 * USDC sent, so a move that fails or runs late leaves the money in the user's
 * wallet, never with the off-ramp provider.
 *
 * Every amount here is in base units: USDC has 6 decimals on both chains.
 */

/** The most one cash-out may move from Fuse, and which bound sets it. */
export interface BridgeCap {
  amountLD: bigint;
  reason: 'balance' | 'per_send' | 'daily' | 'route';
}

/** The part of a cash-out the Base balance doesn't cover. */
export const bridgeShortfall = (amountWei: bigint | undefined, baseBalanceWei: bigint): bigint =>
  amountWei != null && amountWei > baseBalanceWei ? amountWei - baseBalanceWei : 0n;

/** The lowest of the bounds on a move from Fuse; on a tie, the user's own balance. */
export const bridgeCap = (bounds: Record<BridgeCap['reason'], bigint>): BridgeCap =>
  (Object.entries(bounds) as [BridgeCap['reason'], bigint][]).reduce<BridgeCap>(
    (lowest, [reason, amountLD]) => (amountLD < lowest.amountLD ? { amountLD, reason } : lowest),
    { amountLD: bounds.balance, reason: 'balance' },
  );

/** A move from Fuse that can't cover the shortfall; the message is for the amount field. */
export class BridgePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgePlanError';
  }
}

const capMessage = (cap: BridgeCap): string => {
  switch (cap.reason) {
    case 'balance':
      return 'That’s more than your balance once the bridge fee is included';
    case 'per_send':
      return `You can move up to ${formatLD(cap.amountLD.toString())} USDC from Fuse per cash-out`;
    case 'daily':
      return 'That’s over today’s limit for moving USDC from Fuse';
    case 'route':
      return 'Moving that much from Fuse isn’t possible right now. Try a smaller amount';
  }
};

/** Fee rounding can leave a quote a unit or two short; a few re-prices close the gap. */
const MAX_QUOTES = 4;

/**
 * The quote for the smallest move from Fuse that lands at least `shortfallLD`
 * on Base. It starts at the shortfall and adds back whatever the fees took
 * until the quote covers it. Never below the bridge's minimum (the extra stays
 * in the user's Base wallet) and never above `cap`.
 */
export const planBridge = async ({
  shortfallLD,
  minLD,
  cap,
  quote,
}: {
  shortfallLD: bigint;
  minLD: bigint;
  cap: BridgeCap;
  quote: (amountLD: bigint) => Promise<CrossChainSendQuote>;
}): Promise<CrossChainSendQuote> => {
  if (cap.amountLD < minLD || shortfallLD > cap.amountLD) {
    throw new BridgePlanError(capMessage(cap));
  }
  let amountLD = shortfallLD > minLD ? shortfallLD : minLD;
  for (let attempt = 0; attempt < MAX_QUOTES; attempt++) {
    const quoted = await quote(amountLD);
    const receivedLD = BigInt(quoted.amountReceivedLD);
    if (receivedLD >= shortfallLD) return quoted;
    if (amountLD === cap.amountLD) throw new BridgePlanError(capMessage(cap));
    const next = amountLD + (shortfallLD - receivedLD);
    amountLD = next > cap.amountLD ? cap.amountLD : next;
  }
  throw new BridgePlanError('We couldn’t price the move from Fuse. Please try again');
};
