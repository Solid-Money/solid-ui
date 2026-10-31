import { SwapErrorCode, swapErrorCopy } from '@/lib/swapErrors';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { SwapReceipt } from '@/store/swapStore';

/** A reason the swap can't go ahead, with the copy the form shows for it. */
export interface SwapFlowError {
  code: SwapErrorCode;
  copy: string;
}

/** Thrown by `execute` for a stop the user should see, rather than a failure to report. */
export class SwapFlowStop extends Error {
  constructor(readonly code: SwapErrorCode) {
    super(swapErrorCopy(code));
    this.name = 'SwapFlowStop';
  }
}

/**
 * Everything the new swap screens read and do, the same for a swap on Fuse
 * (Algebra), one touching another network (LI.FI), and a move between Fuse and
 * another network over Solid's bridge.
 */
export interface SwapFlowModel {
  route: 'fuse' | 'lifi' | 'bridge';
  /**
   * A Fuse pair that isn't a swap: wrapping FUSE or migrating a pegged coin.
   * The flow hands those to the old form, which knows how.
   */
  isLegacyPair: boolean;
  fromAsset: SwapAssetWithBalance | SwapAsset | undefined;
  toAsset: SwapAssetWithBalance | SwapAsset | undefined;
  /** Base units; undefined while balances load. */
  fromBalance: bigint | undefined;
  /** The whole balance as typed text; gas is sponsored, so all of it can go. */
  maxValue: string | undefined;
  typedValue: string;
  /** Human units of what arrives; undefined until priced. */
  toAmount: number | undefined;
  fromUsd: number | undefined;
  toUsd: number | undefined;
  /** How much "You get" one "You pay" buys, fees included. */
  rate: number | undefined;
  /** Every fee as one figure; null when the route left one unpriced. */
  feeUsd: number | null | undefined;
  feePercentage: number | null | undefined;
  feeFootnote: string | undefined;
  /** 0 when it lands in the same transaction. */
  etaSeconds: number | undefined;
  isCrossChain: boolean;
  /** A line under the details, for what the numbers alone don't say. */
  notice?: string;
  isQuoting: boolean;
  error: SwapFlowError | undefined;
  /** A price is on screen for what's typed and nothing stands in the way. */
  canReview: boolean;
  isSending: boolean;
  /** Re-prices now. False when the new price is worse than the one shown. */
  recheck: () => Promise<boolean>;
  /** Re-checks, signs and sends. Undefined when the user cancelled the signature. */
  execute: () => Promise<SwapReceipt | undefined>;
}
