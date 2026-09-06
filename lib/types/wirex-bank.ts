/**
 * Wirex bank accounts — dedicated EUR SEPA (IBAN/BIC) and USD ACH
 * (account/routing) requisites for receiving, plus outbound transfers.
 *
 * Mirrors the backend DTOs at `/accounts/v1/bank-accounts`. Those are already
 * camelCase — the snake_case Wirex wire format is translated server-side, so
 * nothing here needs to know about it.
 */

/** The two rails this integration provisions. */
export enum WirexBankAccountType {
  SEPA = 'Sepa',
  ACH = 'Ach',
}

/** Lifecycle of a provisioned account. */
export enum WirexBankAccountStatus {
  PENDING = 'Pending',
  ACTIVE = 'Active',
  BLOCKED = 'Blocked',
  CLOSED = 'Closed',
}

/**
 * Which activation call a rail needs.
 *
 * `standard` → POST /activate. `walletLink` → the challenge/sign/complete flow
 * SEPA sometimes requires. `none` → nothing to do (already active, still
 * provisioning, or unavailable).
 */
export type WirexActivationPath = 'standard' | 'walletLink' | 'none';

/**
 * Documented `SepaAccount` / `AchAccount` capability statuses.
 *
 * The API sends this as a free string so a status Wirex adds later still
 * reaches us; treat anything unrecognised as "not actionable".
 */
export enum WirexCapabilityStatus {
  ACTIVE = 'Active',
  ACTIVATION_NOT_STARTED = 'ActivationNotStarted',
  EXTERNAL_PROVIDER_VERIFICATION_REQUIRED = 'ExternalProviderVerificationRequired',
  EXTERNAL_PROVIDER_REGISTRATION_PENDING = 'ExternalProviderRegistrationPending',
  IN_PROGRESS = 'InProgress',
  NOT_FULFILLED = 'NotFulfilled',
  NOT_REQUIRED = 'NotRequired',
  NOT_AVAILABLE = 'NotAvailable',
}

export interface WirexBankAccountDto {
  /** Composite `{account_id}:{details_id}` — opaque here. */
  id: string;
  accountType: WirexBankAccountType;
  /** EUR for SEPA, USD for ACH. */
  currency: string;
  status: WirexBankAccountStatus;
  accountHolder?: string;
  /** SEPA. */
  iban?: string;
  /** SEPA. */
  bic?: string;
  /** ACH. */
  accountNumber?: string;
  /** ACH. */
  routingNumber?: string;
  /** True once requisites exist and the account can actually receive money. */
  canReceive: boolean;
}

/** Everything needed to render one rail. */
export interface WirexBankRailStatusDto {
  accountType: WirexBankAccountType;
  currency: string;
  capabilityStatus: string;
  /** Activation can be started right now. */
  canActivate: boolean;
  activationPath: WirexActivationPath;
  /** Activation requested, requisites not issued yet. */
  isPending: boolean;
  canSendToOwnAccount: boolean;
  canSendToThirdParty: boolean;
  account?: WirexBankAccountDto;
}

/** One token in the Wirex unified balance (WEUR/WUSD on Base). */
export interface WirexUnifiedBalanceDto {
  tokenSymbol: string;
  amount: number;
  /** The fiat the token tracks: EUR for WEUR, USD for WUSD. */
  currency: string;
}

export interface WirexBankOverviewDto {
  rails: WirexBankRailStatusDto[];
  /**
   * False when the user has no Wirex customer at all.
   *
   * Not the same question as `provider`: a user routed to Wirex who has never
   * verified is `provider: 'wirex'` with `isWirexUser: false` — see
   * `kycRequired`.
   */
  isWirexUser: boolean;
  /**
   * Which provider serves this user's virtual account, resolved server-side
   * from their country against Wirex's per-rail availability. Routing is per
   * feature, so this can disagree with whoever issues their card.
   */
  provider: 'wirex' | 'rain';
  /** Wirex serves this country but the user has not verified — send them to Sumsub. */
  kycRequired: boolean;
  /**
   * The balance the bank rails settle into.
   *
   * Empty means UNKNOWN, not zero — the backend returns an empty array when
   * Wirex could not be reached. Never render a 0 from it.
   */
  balances: WirexUnifiedBalanceDto[];
}

export interface WirexWalletLinkChallengeDto {
  challenge: string;
  /** The Primary Smart Wallet Wirex expects the signature from. */
  walletAddress: string;
  chain: string;
}

/** Recipient identity — a person or a company, never both. */
export interface WirexTransferRecipientInput {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  /**
   * Whether this is the user's own account elsewhere. Only selects which
   * capability is pre-checked; Wirex classifies the transfer itself by
   * comparing the recipient name against the verified name.
   */
  isOwnAccount?: boolean;
}

export interface WirexLegalAddressInput {
  line1: string;
  line2?: string;
  city: string;
  /** Required for US addresses. */
  state?: string;
  zipCode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

/** Destination requisites. SEPA uses iban+bic; ACH uses the rest. */
export interface WirexRecipientAccountInput {
  iban?: string;
  bic?: string;
  accountNumber?: string;
  routingNumber?: string;
  bankName?: string;
  /** Required on the ACH rail. */
  legalAddress?: WirexLegalAddressInput;
}

export interface WirexBankTransferEstimateRequest {
  accountType: WirexBankAccountType;
  amount: number;
  recipient: WirexTransferRecipientInput;
  recipientAccount: WirexRecipientAccountInput;
  reference?: string;
  /** Restrict pricing to these tokens. Omit to price all of them. */
  tokens?: string[];
}

export interface WirexBankTransferExecuteRequest extends WirexBankTransferEstimateRequest {
  tokenAddress: string;
  /**
   * Required. Executing without it re-prices at Wirex's current rate, so the
   * charged amount could differ from the one the user confirmed.
   */
  estimationId: string;
}

/** One token the user could pay with, and what it would cost. */
export interface WirexEstimatedAmountDto {
  amount: number;
  /** Smallest-unit amount; the exponent is that token's own decimals. */
  preciseAmount: string;
  tokenAddress: string;
  tokenSymbol: string;
  rate: number;
}

export interface WirexBankTransferEstimateDto {
  estimationId: string;
  /** ISO 8601. */
  expiresAt: string;
  amount: number;
  currency: string;
  estimatedAmounts: WirexEstimatedAmountDto[];
}

export enum WirexBankTransferStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface WirexBankTransferDto {
  /** Wirex activity id. */
  id: string;
  accountType: WirexBankAccountType;
  amount: number;
  currency: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenAmount?: number;
  recipientName: string;
  /** Last 4 of the destination account — the full number is never stored. */
  recipientAccountLast4: string;
  reference?: string;
  status: WirexBankTransferStatus;
  statusReason?: string;
  /** Wirex activity steps completed so far (Initiated, CryptoOut, …). */
  completedSteps: string[];
  createdAt: string;
  updatedAt: string;
}
