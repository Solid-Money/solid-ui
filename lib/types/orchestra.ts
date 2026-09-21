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
  feeAmount?: string;
  feeAsset?: string;
  /** ISO timestamp. Exact-in invoices last ~24h, exact-out and fixed delivery 5 minutes. */
  expiresAt: string;
  amountMode?: OrchestraAmountMode;
  effectiveSlippageBps?: number;
  /** BTC/USD spot the USD amount was converted at. */
  spotUsdPerBtc?: string;
  /**
   * Order-bound read token, returned to client keys only. Required on every
   * later status read and on the SSE stream — without it, reads 403 with
   * `read_token_required`. Valid 24 hours.
   */
  readToken?: string;
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

/** GET /v1/orchestration/estimate — indicative pricing, no order created. */
export interface OrchestraEstimate {
  amountIn?: string;
  estimatedOut?: string;
  feeAmount?: string;
  feeAsset?: string;
  amountMode?: OrchestraAmountMode;
  spotUsdPerBtc?: string;
}

/** The fiat band from /limits, present only when the source is Lightning BTC. */
export interface OrchestraFiatLimits {
  supported: boolean;
  /** USD strings, e.g. "1.00" and "50000.00". */
  min?: string;
  max?: string;
  surfaces?: string[];
}

export interface OrchestraRouteLimits {
  sourceChain: string;
  sourceAsset: string;
  destinationChain: string;
  destinationAsset: string;
  direction?: 'buy' | 'sell' | 'xchain';
  exactOutEligible?: boolean;
  fixedEligible?: boolean;
  limits?: {
    fiatUsd?: OrchestraFiatLimits;
    dynamicProviderLimits?: { possible?: boolean };
  };
}

/** GET /v1/orchestration/limits */
export interface OrchestraLimitsResponse {
  generatedAt?: string;
  routes: OrchestraRouteLimits[];
}

/** One asset entry from GET /v2/orchestration/routes. */
export interface OrchestraRouteAsset {
  /** `<chain>:<asset>`, e.g. "base:USDC". */
  id: string;
  chain: string;
  asset: string;
  assetDisplayName?: string;
  assetDisplaySymbol?: string;
  chainDisplayName?: string;
  contractAddress?: string | null;
  chainId?: string;
  /**
   * Smallest-unit exponent for *this* asset — Base USDC is 6, BSC USDC 18,
   * Hypercore USDC 8. Never inferred from the ticker.
   */
  decimals: number;
  route?: {
    to?: OrchestraRouteSet;
    exactOutTo?: OrchestraRouteSet;
    fixedTo?: OrchestraRouteSet;
  };
}

/** A destination set: everything, an explicit list, or everything but a list. */
export type OrchestraRouteSet = 'all' | string[] | { except: string[] };

/** GET /v2/orchestration/routes */
export interface OrchestraRoutesResponse {
  assets: OrchestraRouteAsset[];
}
