/**
 * Apple Pay / Google Pay wallet top-up through Wirex's hosted checkout (token
 * mode).
 *
 * Mirrors the backend DTOs at `/accounts/v1/wallet-topup` exactly — see the
 * shared contract both sides are built against. The checkout token in a quote
 * is a credential: it is handed to Wirex's checkout and nothing else, never
 * logged, tracked or persisted.
 */

/** Why the feature is, or is not, offered to this user. */
export type WalletTopUpAvailabilityReason =
  | 'ok'
  | 'disabled'
  | 'not_in_cohort'
  | 'not_wirex_user'
  | 'capability_inactive'
  | 'wirex_unavailable';

/** What the user pays with. Also the estimate's `payment_method`. */
export type WalletTopUpMethod = 'apple_pay' | 'google_pay';

/** The currency the top-up is priced in; USD pays out USDC, EUR pays out EURC. */
export type WalletTopUpCurrency = 'USD' | 'EUR';

/** The token the backend pays out on Base. */
export type WalletTopUpToken = 'USDC' | 'EURC';

export type WalletTopUpPlatform = 'ios' | 'android' | 'web';

/** Which Wirex SDK environment, and the company id the web checkout loads with. */
export interface WalletTopUpSdkConfig {
  /** `@wirexapp/card-wallet-topup-web` environment. */
  webEnvironment: 'prod' | 'uat';
  /** `@wirexapp/mobile-sdk` environment. */
  mobileEnvironment: 'production' | 'test';
  /** Wirex company id as a UUID. `null` (QA today): the web checkout cannot load. */
  clientId: string | null;
}

/**
 * Wirex's `topup.providers.<name>` block, passed to the checkout VERBATIM — never
 * re-cased, defaulted or reshaped. An absent `apple_pay` / `google_pay` key means
 * the provider does not offer that wallet.
 */
export interface WalletTopUpProviderConfig {
  apple_pay?: Record<string, unknown>;
  google_pay?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Decimal strings in the currency's own units, e.g. `"10.00"`. */
export interface WalletTopUpLimit {
  min: string;
  max: string;
}

/** GET /accounts/v1/wallet-topup/availability */
export interface WalletTopUpAvailability {
  available: boolean;
  reason: WalletTopUpAvailabilityReason;
  /** Raw Wirex `WalletTopup` capability status, or null. */
  capabilityStatus: string | null;
  /** Null unless available. */
  sdk: WalletTopUpSdkConfig | null;
  /** `topup.default_provider`, or null. */
  provider: string | null;
  /** `topup.providers[default_provider]` verbatim, or null. */
  walletConfig: WalletTopUpProviderConfig | null;
  currencies: WalletTopUpCurrency[];
  defaultCurrency: WalletTopUpCurrency;
  limits: Partial<Record<WalletTopUpCurrency, WalletTopUpLimit>>;
  payoutTokens: Partial<Record<WalletTopUpCurrency, WalletTopUpToken>>;
}

/** POST /accounts/v1/wallet-topup/quote */
export interface WalletTopUpQuoteRequest {
  /** Decimal string, > 0, at most 2 decimals. */
  amount: string;
  currency: WalletTopUpCurrency;
  paymentMethod: WalletTopUpMethod;
  platform: WalletTopUpPlatform;
}

export interface WalletTopUpMoney {
  amount: string;
  currency: string;
}

/** What Wirex's checkout renders and binds the payment sheet to. */
export interface WalletTopUpQuote {
  estimationId: string;
  /** The fiat amount the sheet charges. */
  sourceAmount: WalletTopUpMoney;
  /** What the user gets, in the payout token. */
  destinationAmount: WalletTopUpMoney;
  fee: WalletTopUpMoney | null;
  /** Display string, or null. */
  rate: string | null;
  /** Epoch milliseconds. */
  expiresAtMs: number;
}

export interface WalletTopUpPayout {
  token: WalletTopUpToken;
  chainId: number;
  amount: string;
}

export interface WalletTopUpQuoteResponse {
  estimationId: string;
  provider: string;
  /** `topup.providers[estimate.provider]` verbatim. */
  walletConfig: WalletTopUpProviderConfig;
  /** Restricted Wirex top-up token for this quote. A credential: never log or store it. */
  checkoutToken: string;
  /** Unix seconds. */
  checkoutTokenExpiresAt: number;
  quote: WalletTopUpQuote;
  payout: WalletTopUpPayout;
}

/**
 * Where a top-up is, as the app reads it.
 *
 * - `quoted`: nothing charged yet (or Wirex has not recorded the execute yet)
 * - `pending`: Wirex has the top-up, not completed
 * - `confirmed`: Wirex completed it; our payout is queued or in flight
 * - `completed`: the payout confirmed on Base
 * - `failed`: Wirex failed it (card declined etc.); nothing to pay
 * - `expired`: the quote expired with no execute; nothing charged
 * - `review`: held for ops — terminal for the app's polling
 */
export type WalletTopUpStatus =
  | 'quoted'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'review';

export type WalletTopUpWirexStatus = 'Pending' | 'Completed' | 'Failed';

export type WalletTopUpPayoutStatus = 'none' | 'queued' | 'paid' | 'failed' | 'held';

/** GET /accounts/v1/wallet-topup/:estimationId */
export interface WalletTopUpRecord {
  estimationId: string;
  status: WalletTopUpStatus;
  wirexStatus: WalletTopUpWirexStatus | null;
  payoutStatus: WalletTopUpPayoutStatus;
  payoutTxHash: string | null;
  amount: string;
  currency: WalletTopUpCurrency;
  token: WalletTopUpToken;
  sourceAmount: string;
  sourceCurrency: string;
  paymentMethod: WalletTopUpMethod;
  createdAt: string;
  updatedAt: string;
}

/** The body of a refused request: `code` is the availability reason on a 403. */
export interface WalletTopUpErrorBody {
  message?: string;
  code?: string;
}
