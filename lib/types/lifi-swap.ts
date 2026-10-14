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
}

/** Most received after fees, or quickest to arrive. */
export type LifiRouteOrder = 'CHEAPEST' | 'FASTEST';

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
  solidFee: {
    percentage: number;
    tierName: string;
    waiveReason?: 'TierFree' | 'Disabled';
  };
  transactionRequest: {
    to: Address;
    data: `0x${string}`;
    value: string;
    chainId: number;
  };
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
