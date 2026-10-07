/**
 * Cross-chain send ("Withdraw to another network"): the wire contract with
 * `/accounts/v1/cross-chain-sends` in flash-accounts-service.
 *
 * Every token amount in this file is a base-unit string in the *Fuse* token's
 * decimals (6 for USDC.e and USDT). Native fees are wei strings. The voucher is
 * the exact EIP-712 struct `BridgePaymaster.bridgeSend` verifies, so its field
 * names and order match the contract and must not be reshaped on the client.
 */

export type CrossChainSendToken = 'USDC' | 'USDT';

export type CrossChainSendNetworkStatus = 'live' | 'coming_soon';

export interface CrossChainSendTokenConfig {
  symbol: CrossChainSendToken;
  /** The token held on Fuse (USDC.e / USDT). */
  address: string;
  /** The Stargate OFT on Fuse that burns it. */
  oft: string;
  decimals: number;
}

export interface CrossChainSendNetworkConfig {
  chainId: number;
  /** LayerZero endpoint id. */
  eid: number;
  key: 'arbitrum' | 'base' | 'bsc' | 'ethereum' | 'polygon' | 'fuse';
  name: string;
  etaMinutes: number;
  status: CrossChainSendNetworkStatus;
  /** Tokens that have a Stargate route from Fuse to this network. */
  tokens: CrossChainSendToken[];
  /** What the recipient gets, per token, e.g. "Native USDC", "USDT0". */
  receivesAs: Partial<Record<CrossChainSendToken, string>>;
  /** Decimals of the destination token (BNB Chain pegged tokens use 18). */
  dstDecimals: Partial<Record<CrossChainSendToken, number>>;
}

export interface CrossChainSendExchangeNetwork {
  chainId: number;
  recommended?: boolean;
  /** The network name as the exchange's deposit page calls it, e.g. "Arbitrum One". */
  depositNetworkLabel: string;
}

export interface CrossChainSendExchangeConfig {
  /** Stable id stored on the send and the address book, e.g. "binance". */
  id: string;
  name: string;
  /**
   * Networks the exchange credits, per token. A token missing here means the
   * exchange takes none of our networks for it. `other_exchange` and
   * `own_wallet` list every live network.
   */
  networks: Partial<Record<CrossChainSendToken, CrossChainSendExchangeNetwork[]>>;
}

export interface CrossChainSendRouteStatus {
  token: CrossChainSendToken;
  chainId: number;
  /** Stargate's live credit for the route (`OFTLimit.maxAmountLD`). */
  maxAmountLD: string;
  minAmountLD: string;
  /** False when the route has no credit or the read failed. */
  available: boolean;
  updatedAt: string;
}

export interface CrossChainSendLimits {
  /** Per-send floor, base units (5 USDC). */
  perSendMin: string;
  /** Per-send floor on Ethereum, base units (10 USDC). */
  perSendMinEthereum: string;
  /** Per-send cap, base units (10,000 USDC). */
  perSendMax: string;
  /** Per-user daily cap, base units (25,000 USDC). */
  dailyMax: string;
  /** Per-user sends per UTC day. */
  dailySends: number;
  /** Slippage applied between "They receive" and "Min. receive". */
  slippageBps: number;
  /** Seconds a voucher stays valid after it is signed. */
  voucherTtlSeconds: number;
}

export interface CrossChainSendConfig {
  /** False only while the backend can't sign vouchers; the app then keeps the plain send. */
  enabled: boolean;
  tokens: CrossChainSendTokenConfig[];
  networks: CrossChainSendNetworkConfig[];
  /** In chip order. */
  exchanges: CrossChainSendExchangeConfig[];
  routes: CrossChainSendRouteStatus[];
  limits: CrossChainSendLimits;
  /** Fuse BridgePaymaster proxy the user op approves and calls. */
  bridgePaymaster: string;
  /** Daily usage of the calling user, for the limits copy. */
  usage: {
    sentTodayLD: string;
    sendsToday: number;
  };
}

export interface CrossChainSendQuote {
  quoteId: string;
  token: CrossChainSendToken;
  dstChainId: number;
  dstEid: number;
  oft: string;
  /** Total pulled from the Safe: what the user typed. */
  amountLD: string;
  /** LayerZero fee repaid in the token (the "network fee" part). */
  feeLD: string;
  /** Stargate's own fee: (amountLD - feeLD) - amountReceivedLD. */
  bridgeFeeLD: string;
  /** feeLD + bridgeFeeLD, the single fee line the UI shows. */
  totalFeeLD: string;
  /** Expected credit on the destination, Fuse decimals ("They receive"). */
  amountReceivedLD: string;
  /** Slippage floor the voucher carries ("Min. receive"). */
  minAmountLD: string;
  /** Quoted LayerZero fee in wei. */
  nativeFee: string;
  /** nativeFee plus headroom; the paymaster reverts above it. */
  maxNativeFee: string;
  fuseUsdPrice: number;
  /** Route credit at quote time. */
  maxAmountLD: string;
  etaMinutes: number;
  /** When the app should re-quote. */
  expiresAt: string;
}

/** The EIP-712 `SendVoucher` struct, field for field. All numbers are decimal strings. */
export interface CrossChainSendVoucher {
  from: string;
  oft: string;
  dstEid: number;
  to: string;
  amountLD: string;
  feeLD: string;
  maxNativeFee: string;
  minAmountLD: string;
  nonce: string;
  deadline: string;
}

export interface CrossChainSendAuthoriseRequest {
  token: CrossChainSendToken;
  dstChainId: number;
  recipient: string;
  /** Exchange id from the config, or `own_wallet` / `other_exchange`. */
  exchange: string;
  amountLD: string;
  /** What the review screen showed; the backend re-prices against it. */
  expectedAmountReceivedLD: string;
  quoteId: string;
}

export interface CrossChainSendAuthorised {
  /** Backend id of the send; the app uses it as the activity's clientTxId. */
  sendId: string;
  voucher: CrossChainSendVoucher;
  signature: string;
  bridgePaymaster: string;
  tokenAddress: string;
  quote: CrossChainSendQuote;
}

export type CrossChainSendAuthoriseResponse =
  | { status: 'ok'; send: CrossChainSendAuthorised }
  | { status: 'requote'; quote: CrossChainSendQuote; reason: string };

export type CrossChainSendStatus =
  | 'authorised'
  | 'expired'
  | 'sent'
  | 'delivered'
  | 'stuck'
  | 'failed';

export interface CrossChainSendRecord {
  sendId: string;
  status: CrossChainSendStatus;
  token: CrossChainSendToken;
  dstChainId: number;
  recipient: string;
  exchange: string;
  amountLD: string;
  feeLD: string;
  bridgeFeeLD: string;
  /** Expected at quote time; replaced by the on-chain amount once sent. */
  amountReceivedLD: string;
  minAmountLD: string;
  etaMinutes: number;
  srcTxHash?: string;
  srcExplorerUrl?: string;
  dstTxHash?: string;
  dstExplorerUrl?: string;
  /** LayerZero message guid. */
  guid?: string;
  createdAt: string;
  deadline: string;
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string;
}
