import { Address } from 'viem';

/** One token on one chain, as the swap form and its picker know it. */
export interface SwapAsset {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isNative: boolean;
}

export interface SwapAssetWithBalance extends SwapAsset {
  /** Human units, for display and sorting. */
  balance: number;
  /** Base units, for anything that has to be exact (max, funding checks). */
  balanceRaw: bigint;
  balanceUsd: number;
  /** The wallet's USD price for one unit; 0 when it has none. */
  priceUsd: number;
  /**
   * On the swap list (or the chain's native coin). A token the wallet holds
   * that the list doesn't name can't be quoted: "You pay" shows it greyed out,
   * "You get" leaves it out.
   */
  swappable: boolean;
}

/** Most received after fees, or quickest to arrive. */
export type LifiRouteOrder = 'CHEAPEST' | 'FASTEST';

/**
 * Why a swap is being made, when that changes how it is priced. `tier_upgrade`
 * pays for a membership in USDC on Fuse and is quoted without Solid's fee.
 */
export type LifiSwapPurpose = 'tier_upgrade';

// Mirrors solid-backend lifi-swap/interfaces/lifi-swap.interface.ts.

export interface LifiSwapToken {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  priceUsd?: string;
}

/**
 * One line of the fee breakdown. `solid` is our fee, `lifi` is LI.FI's own,
 * `provider` is what the bridges and DEXes on the route take.
 */
export interface LifiSwapFee {
  kind: 'solid' | 'lifi' | 'provider';
  name: string;
  token: LifiSwapToken;
  amount: string;
  amountUsd: string | null;
  /** True when deducted from the swapped amount, false when paid on top. */
  included: boolean;
}

export interface LifiSwapQuote {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromToken: LifiSwapToken;
  toToken: LifiSwapToken;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  fromAmountUsd: string | null;
  toAmountUsd: string | null;
  slippage: number;
  executionDurationSeconds: number;
  approvalAddress: Address;
  fees: LifiSwapFee[];
  gasCosts: { token: LifiSwapToken; amount: string; amountUsd: string | null }[];
  steps: { type: string; tool: string; name: string; logoURI?: string }[];
  /**
   * Every fee on the route as one figure (ours, LI.FI's, the bridges' and
   * DEXes'); gas is sponsored and not in it. Null amounts when LI.FI left a
   * fee unpriced. Absent from a backend that predates it.
   */
  totalFee?: { amountUsd: string | null; percentage: number | null };
  /** The pair's smallest `fromAmount`, base units; null when unpriced. */
  minFromAmount?: string | null;
  solidFee: {
    percentage: number;
    tierName: string;
    waiveReason?: 'TierFree' | 'Disabled' | 'TierUpgrade';
  };
  transactionRequest: {
    to: Address;
    data: `0x${string}`;
    value: string;
    chainId: number;
  };
}

/** A token the "You get" picker can offer for one "You pay" token. */
export interface LifiSwapDestination {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  /** The smallest amount of the "You pay" token for this pair, base units. */
  minFromAmount: string | null;
}

export interface LifiSwapDestinations {
  fromChainId: number;
  fromToken: string;
  /** False when the backend couldn't read the route map and offered the whole list. */
  routesChecked: boolean;
  destinations: LifiSwapDestination[];
}

export type LifiSwapStatusValue = 'NOT_FOUND' | 'INVALID' | 'PENDING' | 'DONE' | 'FAILED';

export interface LifiSwapStatus {
  status: LifiSwapStatusValue;
  /** e.g. COMPLETED, PARTIAL (destination swap failed, bridged token delivered), REFUNDED. */
  substatus?: string;
  substatusMessage?: string;
  explorerLink?: string;
  sendingTxHash?: string;
  sendingTxLink?: string;
  receivingTxHash?: string;
  receivingTxLink?: string;
  receivingAmount?: string;
  receivingToken?: LifiSwapToken;
}
