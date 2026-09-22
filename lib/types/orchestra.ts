/**
 * Flashnet Orchestra — Lightning fiat onramp.
 *
 * Mirrors the wire shapes at https://docs.flashnet.xyz/orchestra/onramp. Amounts
 * are integer strings in the asset's smallest unit throughout, never numbers:
 * sats on the Lightning leg, the destination asset's own decimals on the other,
 * and JSON numbers would lose precision on both.
 */

/** Orchestra states while the order is still moving. See /orchestra/status. */
export type OrchestraInFlightStatus =
  | 'processing'
  | 'confirming'
  | 'awaiting_approval'
  | 'swapping'
  | 'bridging'
  | 'delivering'
  | 'refunding';

/**
 * Terminal-ish states. `unfulfilled` is the odd one: the deposit was never
 * confirmed or was replaced, and a late payment can still resume the order
 * during the six-hour recovery window — so it does not close the stream.
 */
export type OrchestraOutcomeStatus =
  | 'completed'
  | 'refunded'
  | 'failed'
  | 'expired'
  | 'unfulfilled';

export type OrchestraStatus = OrchestraInFlightStatus | OrchestraOutcomeStatus;

/**
 * Nothing more will arrive without the user starting over, so tracking can stop
 * — both the poll and our end of the SSE stream.
 *
 * The server closes the stream on `completed`, `failed` and `refunded`, and
 * leaves it open on `unfulfilled` because a late deposit can still resume the
 * order during the six-hour recovery window. `expired` is ours to add: the
 * server says nothing about it, and an order that expired without a deposit has
 * nothing left to report.
 */
export const ORCHESTRA_SETTLED_STATUSES: readonly OrchestraStatus[] = [
  'completed',
  'failed',
  'refunded',
  'expired',
];

/** Settled without delivering. */
export const ORCHESTRA_FAILED_STATUSES: readonly OrchestraStatus[] = [
  'failed',
  'refunded',
  'expired',
];

/** `exact_in` spends a fixed input and fees reduce delivery; `exact_out` fixes delivery. */
export type OrchestraAmountMode = 'exact_in' | 'exact_out';

export interface OrchestraPaymentLinks {
  /** Deep link that opens Cash App on the invoice. Navigate to it — never fetch it. */
  cashApp?: string;
  /** Orchestra-hosted handoff page (mobile) / QR page (desktop) for this order. */
  shortUrl?: string;
}

/** Request body for POST /v1/orchestration/onramp. */
export interface OrchestraOnrampRequest {
  destinationChain: string;
  destinationAsset: string;
  recipientAddress: string;
  /** USD string, "1.00" to "50000.00". Mutually exclusive with `amount`. */
  amountFiatUsd?: string;
  /** Smallest units — sats for exact-in, destination units for exact-out. */
  amount?: string;
  amountMode?: OrchestraAmountMode;
  /** Lightning address (user@domain) or an amountless BOLT11, used if the order fails. */
  refundAddress?: string;
}

/** Response from POST /v1/orchestration/onramp. */
export interface OrchestraOnrampOrder {
  orderId: string;
  quoteId: string;
  /** The BOLT11 invoice to pay. */
  depositAddress: string;
  paymentLinks?: OrchestraPaymentLinks;
  /** Sats the payer sends. */
  amountIn: string;
  /** Destination smallest units expected on delivery. */
  estimatedOut: string;
  /** The swap fee alone. `totalFeeAmount` is the one to show a user. */
  feeAmount?: string;
  /** Rounding applied on top of the swap fee; already included in the total. */
  roundingFeeAmount?: string;
  /** feeAmount + roundingFeeAmount — what the deposit actually costs. */
  totalFeeAmount?: string;
  /** The route's fee rate in basis points, e.g. 60 for 0.6%. */
  feeBps?: number;
  feeAsset?: string;
  /**
   * The fee asset's own decimals, which need not match the destination's — read
   * from here rather than inferred from the ticker.
   */
  feeAssetDetails?: { asset?: string; assetDisplaySymbol?: string; decimals: number };
  feeAmountUsd?: string;
  totalFeeAmountUsd?: string;
  /** ISO timestamp. Exact-in invoices last ~24h, exact-out and fixed delivery 5 minutes. */
  expiresAt: string;
  amountMode?: OrchestraAmountMode;
  effectiveSlippageBps?: number;
  /** BTC/USD spot the USD amount was converted at. */
  spotUsdPerBtc?: string;
  /** Fields Orchestra dropped rather than rejecting the request over. */
  ignoredFields?: string[];
}

/** One execution milestone from the status response. */
export interface OrchestraStage {
  name: string;
  completedAt?: string | null;
}

/** The order half of GET /v1/orchestration/status. */
export interface OrchestraOrder {
  orderId?: string;
  quoteId?: string;
  status: OrchestraStatus;
  amountIn?: string;
  amountOut?: string;
  estimatedOut?: string;
  destinationChain?: string;
  destinationAsset?: string;
  recipientAddress?: string;
  /** Present on failures and refunds; see the order-error codes in /api/errors. */
  errorCode?: string;
  /** An `unfulfilled` order whose deposit was replaced points at its successor. */
  supersededByOperationId?: string;
  recoveredFromOperationId?: string;
  reviewStatus?: string;
}

/** GET /v1/orchestration/status?id=… */
export interface OrchestraStatusResponse {
  order: OrchestraOrder | null;
  stages?: OrchestraStage[];
}

/** The fiat band from /limits, present only when the source is Lightning BTC. */

/**
 * GET /accounts/v1/orchestra/config — everything the amount screen needs in one
 * call: where the deposit lands, how that asset's amounts are scaled, and the
 * band the entered amount has to fall inside.
 *
 * The bounds arrive as numbers rather than the USD strings Orchestra publishes,
 * because the backend has already parsed them and a form compares numbers.
 */
export interface OrchestraConfig {
  destinationChain: string;
  destinationAsset: string;
  /** Smallest-unit exponent for the destination; absent if /routes was unreadable. */
  decimals?: number;
  assetDisplaySymbol?: string;
  chainDisplayName?: string;
  minUsd: number;
  maxUsd: number;
}
