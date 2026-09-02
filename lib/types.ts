import { Reward } from '@merkl/api';
import { Address, Hex } from 'viem';

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { DigitalWalletType } from '@/constants/digital-wallet';
import {
  DEPOSIT_FROM_SAFE_ACCOUNT_MODAL,
  DEPOSIT_MODAL,
  SEND_MODAL,
  STAKE_MODAL,
  SWAP_MODAL,
  UNSTAKE_MODAL,
  WITHDRAW_MODAL,
} from '@/constants/modals';

import type { AssetPath } from './assets';

export interface CountryInfo {
  countryCode: string;
  countryName: string;
  /**
   * Whether the **card** is available here. Virtual account availability is a
   * separate list — ask `resolveCountryAccess('virtual_account')` for it rather
   * than reading this field.
   */
  isAvailable: boolean;
  source?: 'ip' | 'manual';
  /** State / province, when the IP lookup resolved one. */
  state?: string;
  city?: string;
}

/** Products gated on where the user is. */
export type GatedProduct = 'card' | 'virtual_account';

/** Body of `POST /accounts/v1/region-interest`. */
export interface RegionInterestPayload {
  product: GatedProduct;
  countryCode: string;
  countryName?: string;
  state?: string;
  city?: string;
  detectionSource?: 'ip' | 'manual' | 'kyc';
  source?: string;
}

export interface CardAccessResponse {
  hasAccess: boolean;
  countryCode: string;
}

export interface CardWaitlistResponse {
  isInWaitlist: boolean;
  email?: string;
  countryCode?: string;
  joinedAt?: Date;
}

export interface DirectDepositSessionResponse {
  sessionId: string;
  walletAddress: string;
  chainId: number;
  status: 'pending' | 'detected' | 'processing' | 'completed' | 'failed' | 'expired';
  expiresAt: number;
  minDeposit: string;
  maxDeposit: string;
  fee: string;
  detectedAmount?: string;
  transactionHash?: string;
  clientTxId?: string;
}

/** Poll response for a deposit landing on the user's direct deposit address. */
export interface DetectedDirectDepositResponse {
  detected: boolean;
  clientTxId?: string;
  status?: string;
  depositStep?: string;
  amount?: string;
  symbol?: string;
  chainId?: number;
  transactionHash?: string;
  detectedAt?: string;
}

export interface CardDepositBonusConfig {
  isEnabled: boolean;
  percentage: number;
  cap: number;
}

export interface LandingPageApyWindows {
  allTime: number;
  sevenDay: number;
  fifteenDay: number;
  thirtyDay: number;
}

/** Response of GET /accounts/v1/app-config/landing-page-apy — admin-managed APY. */
export interface LandingPageApyConfig {
  overrideEnabled: boolean;
  mode: 'simple' | 'advanced';
  apy: number;
  apys: {
    usdc: LandingPageApyWindows;
    fuse: LandingPageApyWindows;
    eth: LandingPageApyWindows;
  };
}

export interface CardWithdrawalDestination {
  chain: string;
  address: string;
  memo?: string;
}

export interface CardWithdrawal {
  amount: string;
  destination: CardWithdrawalDestination;
  clientNote?: string;
}

export interface CardWithdrawalResponse {
  id: string;
  amount: string;
  currency: string;
  destination: CardWithdrawalDestination & {
    tx_hash?: string;
    gas_fee?: { amount: string; currency: string };
  };
  status?: string;
  created_at?: string;
  updated_at?: string;
  client_note?: string;
  type?: 'top_up_balance_withdrawal' | 'fee';
}

export interface WithdrawFromCardToSavingsResponse {
  withdrawalId: string;
  status: 'pending';
  amount: string;
}

/** Rain: request withdrawal signature data. amount = token smallest units (e.g. USDC 6 decimals). */
export interface WithdrawCollateralRequest {
  amount: string;
  recipientAddress: string;
  adminAddress: string;
  chainId?: number;
  tokenAddress?: string;
}

/** Rain withdrawal signature data returned by backend for frontend to execute the on-chain tx. */
export interface WithdrawCollateralSignatureResponse {
  collateralProxy: string;
  assetAddress: string;
  amount: string;
  recipient: string;
  expiresAt: number;
  executorPublisherSalt: string;
  executorPublisherSig: string;
  coordinatorAddress: string;
  chainId: number;
}

export interface HoldingFundsPointsMultiplierConfig {
  holdingFundsPointsMultiplier: number;
}

export enum Status {
  IDLE = 'idle',
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export enum InviteCodeStatus {
  CHECKING = 'checking',
  VALID = 'valid',
  INVALID = 'invalid',
  NONE = 'none',
}

// from @safe-global/protocol-kit as the package
// is throwing static class blocks error
export type PasskeyCoordinates = {
  x: string;
  y: string;
};

export type PasskeyArgType = {
  rawId: string;
  coordinates: PasskeyCoordinates;
  credentialId: string;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  username: string;
  safeAddress: Address;
  walletAddress?: string;
  hasPasskey?: boolean;
  selected: boolean;
  signWith: string;
  suborgId: string;
  userId: string;
  referralCode?: string;
  isDeposited?: boolean;
  tokens?: AuthTokens;
  email?: string;
  turnkeyUserId?: string;
  leaderboardPosition?: number;
  points?: number;
  credentialId?: string;
  /**
   * Every WebAuthn credential Turnkey holds for this account. Recovery *adds* a
   * passkey rather than replacing the lost one, so a single value cannot
   * describe the account — these feed `allowCredentials` on every passkey
   * prompt, and pinning to one credential the authenticator no longer holds
   * breaks every in-app action while login (unfiltered) keeps working.
   */
  credentialIds?: string[];
  externalWalletAddress?: string;
}

export type BlockscoutTransaction = {
  to: {
    hash: Address;
    name: string;
  };
  token: {
    address: Address;
    symbol: string;
    icon_url: string;
  };
  total: {
    decimals: string;
    value: string;
  };
  transaction_hash: string;
  timestamp: string;
  type: string;
};

export interface BlockscoutTransactions {
  items: BlockscoutTransaction[];
}

export type Token = {
  name: string;
  address: Address;
  symbol: string;
  decimals: number;
  imageId: string;
  isComingSoon?: boolean;
};

export type TokenWithBalance = Token & {
  balance: number;
  balanceUSD: number;
};

export type TokenMap = {
  [key in number]: Token[];
};

export type TokenPriceUsd = {
  data: {
    symbol: string;
    prices: {
      currency: string;
      value: string;
      lastUpdatedAt: string;
    }[];
  }[];
};

export enum RainConsumerType {
  US = 'us',
  INTERNATIONAL = 'international',
}

export type KycLinkAgreements = {
  agreedToEsign: boolean;
  agreedToTerms: boolean;
  agreedToAccountOpeningPrivacy?: boolean;
  agreedToCertify: boolean;
  agreedToNoSolicitation: boolean;
};

export type KycLink = {
  kycLinkId: string;
  link: string;
  tosLink: string;
};

export type KycRejectionReason = { reason: string };

export type KycLinkFromBridgeResponse = {
  id: string;
  full_name: string;
  email: string;
  type: string;
  kyc_link: string;
  tos_link: string;
  kyc_status: string;
  rejection_reasons: KycRejectionReason[];
  tos_status: string;
  customer_id: string;
};

export type KycLinkForExistingCustomer = {
  url: string;
};

export type BridgeCustomerResponse = {
  bridgeCustomerId: string;
  kycStatus: KycStatus;
  tosStatus: TermsOfServiceStatus;
  kycLinkId: string;
};

export type BridgeRejectionReason = {
  developer_reason: string;
  reason: string;
  created_at: string;
};

export interface CustomerFromBridgeResponse {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  type: string;
  has_accepted_terms_of_service: boolean;
  rejection_reasons: BridgeRejectionReason[];
  requirements_due: string[];
  future_requirements_due: string[];
  endorsements: BridgeCustomerEndorsement[];
}

// Issue can be a string like "endorsement_not_available_in_customers_region"
// or an object like { id_front_photo: "id_expired" }
export type BridgeEndorsementIssue = string | Record<string, string>;

export type BridgeEndorsementRequirements = {
  complete: string[];
  pending: string[];
  missing: Record<string, unknown>;
  issues: BridgeEndorsementIssue[];
};

export type BridgeCustomerEndorsement = {
  name: string;
  status: EndorsementStatus;
  additional_requirements?: string[];
  requirements?: BridgeEndorsementRequirements;
};

export enum KycStatus {
  NOT_STARTED = 'not_started',
  INCOMPLETE = 'incomplete',
  AWAITING_QUESTIONNAIRE = 'awaiting_questionnaire',
  AWAITING_UBO = 'awaiting_ubo',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAUSED = 'paused',
  OFFBOARDED = 'offboarded',
}

export enum TermsOfServiceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
}

export enum CardStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  INACTIVE = 'inactive',
  FROZEN = 'frozen',
}

enum FreezeReason {
  LOST_OR_STOLEN = 'lost_or_stolen',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  PLANNED_INACTIVITY = 'planned_inactivity',
  SUSPECTED_FRAUD = 'suspected_fraud',
  OTHER = 'other',
}

export enum FreezeInitiator {
  BRIDGE = 'bridge',
  DEVELOPER = 'developer',
  CUSTOMER = 'customer',
}

interface CardDetails {
  last_4: string;
  expiry: string;
  bin: string;
}

interface Balance {
  amount: string;
  currency: string;
}

interface Balances {
  available: Balance;
  hold: Balance;
}

interface CryptoAccount {
  type: string;
  address: string;
}

interface FundingInstructions {
  currency: string;
  chain: string;
  address: string;
  memo: string;
}

interface AdditionalFundingInstructions {
  currency: string;
  chain: string;
  address: string;
}

interface Freeze {
  initiator: FreezeInitiator;
  card_account_id: string;
  reason: FreezeReason;
  reason_detail?: string;
  starting_at?: string;
  ending_at?: string;
  created_at: string;
}

export interface CardHolderName {
  first_name: string;
  last_name: string;
}

export interface CardResponse {
  id: string;
  client_reference_id: string;
  customer_id: string;
  card_image_url: string;
  status: CardStatus;
  status_reason: string;
  card_details: CardDetails;
  cardholder_name: CardHolderName;
  balances: Balances;
  freezes: Freeze[];
  crypto_account: CryptoAccount;
  funding_instructions: FundingInstructions;
  additional_funding_instructions?: AdditionalFundingInstructions[];
}

export interface CashbackData {
  monthlySoUsdAmount: number;
  monthlyUsdValue: number;
  /**
   * Cashback earned this month that is still escrowed, projected in USD.
   * Absent on backends that predate the pending projection.
   */
  monthlyPendingUsdValue?: number;
  totalSoUsdAmount: number;
  totalUsdValue: number;
  percentage: number;
}

/** Card issuance provider; backend may add to details/status */
export enum CardProvider {
  BRIDGE = 'bridge',
  RAIN = 'rain',
  WIREX = 'wirex',
}

/**
 * Identity-verification provider. Didit backs the Rain flow; Sumsub backs the
 * Wirex (EU/EEA) flow. Chosen by jurisdiction at the /card/activate KYC step.
 */
export enum KycProvider {
  DIDIT = 'didit',
  SUMSUB = 'sumsub',
}

/** Card deposit activity metadata processing status */
export enum CardDepositProcessingStatus {
  SENDING = 'sending',
  AWAITING_BRIDGE = 'awaiting_bridge',
  AWAITING_RAIN = 'awaiting_rain',
}

export interface CardDetailsResponseDto extends CardResponse {
  cashback: CashbackData;
  /** Set by backend when available */
  provider?: CardProvider;
  /**
   * ISO 3166-1 alpha-2 of the address the card was issued against, read from the
   * provider's consumer record. Distinct from `CardStatusResponse.country`, which is
   * the user's KYC residence.
   */
  issuing_country?: string;
}

/**
 * A single warning entry surfaced for a user's KYC. Mirrors Didit's per-block warning shape:
 * `risk` is the tag (DOCUMENT_EXPIRED, DATE_OF_BIRTH_NOT_DETECTED, ...) — same key space as
 * DIDIT_WARNING_DESCRIPTIONS overrides; `short_description` / `long_description` are Didit's
 * pre-formatted user-facing copy. Backend also synthesises one of these (with
 * `risk: 'CARD_ACTIVATION_FAILED'`) when Rain rejects the forwarded application.
 */
export interface KycWarning {
  risk: string;
  log_type?: string;
  short_description?: string;
  long_description?: string;
  feature?: string;
  node_id?: string;
}

export interface CardStatusResponse {
  status?: CardStatus;
  activationBlocked?: boolean;
  activationBlockedReason?: string;
  activationFailedAt?: string;
  /** Set by backend when available; used to branch Bridge vs Rain flows */
  provider?: CardProvider;
  /** Internal KYC status (covers Didit rejection before Rain is reached) */
  kycStatus?: KycStatus;
  /** Warning entries from Didit verification (e.g. DOCUMENT_EXPIRED) and Rain forward failures. */
  kycWarnings?: KycWarning[];
  /** Rain KYC: application status from Rain */
  rainApplicationStatus?: RainApplicationStatus;
  /**
   * True once a provider (Rain) consumer exists for this user. Creating a new
   * Didit/Sumsub session in that state is refused with 409 KYC_ALREADY_EXISTS,
   * so never offer a "start KYC" action when this is set — a resubmission has
   * to go through `applicationExternalVerificationLink` instead.
   */
  kycApplicationEstablished?: boolean;
  /** Rain: link for needsVerification redirect */
  applicationExternalVerificationLink?: { url: string; params: Record<string, string> };
  /**
   * User's KYC residence country (ISO 3166-1 alpha-2, e.g. "BD"). Drives the
   * country-specific issuance steps (the Bangladesh deposit-first step).
   */
  country?: string;
  /**
   * Total Rain collateral the user has deposited to their card, in cents. The
   * Bangladesh deposit-first step now completes from the savings (soUSD) balance
   * instead; this remains as a backward-compatible fallback so users who funded
   * a card under the old flow still count as having met the deposit.
   */
  cardCollateralDeposited?: number;
}

export interface SubmitPersonaKycRequest {
  personaInquiryId: string;
}

export interface SubmitPersonaKycResponse {
  consumerId: string;
  kycStatus: KycStatus;
}

// --- Rain KYC (in-house API) ---
export interface RainKycAddress {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/** Rain KYC application states (consumer program) */
export enum RainApplicationStatus {
  APPROVED = 'approved',
  PENDING = 'pending',
  MANUAL_REVIEW = 'manualReview',
  DENIED = 'denied',
  LOCKED = 'locked',
  CANCELED = 'canceled',
  NEEDS_VERIFICATION = 'needsVerification',
  NEEDS_INFORMATION = 'needsInformation',
  NOT_STARTED = 'notStarted',
}

export interface RainKycSubmitResponse {
  applicationStatus: RainApplicationStatus;
  rainUserId?: string;
  applicationExternalVerificationLink?: {
    url: string;
    params: { userId: string; [key: string]: string };
  };
}

export interface RainKycStatusResponse {
  applicationStatus: RainApplicationStatus;
  applicationExternalVerificationLink?: {
    url: string;
    params: { userId: string; [key: string]: string };
  };
}

/** Document type for Rain KYC upload */
export type RainDocumentType = 'idCard' | 'passport' | 'drivers' | 'residencePermit' | 'selfie';

// --- Didit identity verification ---

/** Response from POST /accounts/v1/didit/session. Backend may return Didit's raw `url` or our `verification_url`. */
export interface DiditSessionResponse {
  session_id: string;
  session_token: string;
  /** Preferred; if missing, use `url` (Didit API shape). */
  verification_url?: string;
  /** Didit API returns this; use when verification_url is absent. */
  url?: string;
  status: string;
}

/** Response from GET /accounts/v1/didit/status. */
export interface DiditVerificationStatusResponse {
  status: string;
  kycStatus: KycStatus;
  sessionId?: string;
}

/**
 * Which product a Sumsub session belongs to. 'card' is the Wirex card flow;
 * 'onramp' is buy-crypto (TransFi). The backend uses this to decide what it
 * records on the card customer — the SDK experience is identical.
 */
export type SumsubSessionFlow = 'card' | 'onramp';

/** Response from POST /accounts/v1/sumsub/session. Access token for the WebSDK. */
export interface SumsubSessionResponse {
  /** WebSDK access token passed to snsWebSdk.init(). */
  token: string;
  /** externalUserId bound to the token (our internal userId). */
  userId: string;
  /** Verification level the token was minted for. */
  levelName: string;
  /** Which product the session was created for. */
  flow?: SumsubSessionFlow;
}

/** Response from GET /accounts/v1/sumsub/status. */
export interface SumsubVerificationStatusResponse {
  /** GREEN | RED (Sumsub review answer), if reviewed. */
  reviewAnswer?: string;
  /** Sumsub review status (init | pending | completed | onHold …). */
  reviewStatus?: string;
  /** Canonical backend KYC status (reflects Sumsub + Wirex). */
  kycStatus?: KycStatus;
  applicantId?: string;
}

/** Response from GET /accounts/v1/sumsub/provider-routing. */
export interface ProviderRoutingResponse {
  countryCode: string | null;
  cardProvider: CardProvider;
  kycProvider: KycProvider;
}

// --- Rain balance (cents) ---
export interface CardBalanceResponseDto {
  creditLimit?: number;
  pendingCharges?: number;
  postedCharges?: number;
  balanceDue?: number;
  spendingPower?: number;
}

export interface WalletEligibilityResponse {
  eligible: boolean;
  alreadyInAppleWallet?: boolean;
  alreadyInGoogleWallet?: boolean;
  reason?: string;
}

export interface ProvisioningSessionRequest {
  wallet?: DigitalWalletType;
}

export interface ProvisioningSessionResponse {
  sessionId: string;
  expiresAt: string;
}

export interface MppCredentialsResponse {
  cardId: string;
  cardSecret: string;
}

export interface WebProvisioningTokenResponse {
  token?: string;
  [key: string]: unknown;
}

export interface ExtensionCardEntry {
  cardId: string;
  cardSecret: string;
  cardholderName: string;
  lastFour: string;
  artUrl?: string;
}

export interface ExtensionCardsResponse {
  cards: ExtensionCardEntry[];
}

// --- Rain card secrets (reveal PAN/CVC) ---
export interface CardSecretsEncryptedField {
  iv: string;
  data: string;
}

export interface CardSecretsResponseDto {
  encryptedPan: CardSecretsEncryptedField;
  encryptedCvc: CardSecretsEncryptedField;
}

// --- Rain card PIN ---
export interface CardPinResponseDto {
  encryptedPin: CardSecretsEncryptedField;
}

// --- Wirex card reveal ---
/**
 * A short-lived, user-scoped Wirex session minted by our backend so this client
 * can read its own card's PAN/CVV directly from Wirex.
 *
 * Wirex requires sensitive card data to be fetched client-side unless the
 * proxying backend is PCI DSS compliant, so the card number travels from Wirex
 * straight to the device and never through our servers. `accessToken` is a
 * secret: keep it in memory for the duration of the reveal and never persist it.
 */
export interface WirexRevealSessionResponse {
  accessToken: string;
  expiresAt?: number;
  /** Wirex API origin, supplied by the backend so envs can move without a release. */
  apiBaseUrl: string;
  chainId: string;
  cardId: string;
  /** The EOA that must sign the confirmation message. */
  walletAddress: string;
  /** Action the signature is scoped to (`GetCardDetails`). */
  actionType: string;
  /** Message to sign, containing a `{nonce}` placeholder to substitute. */
  messageTemplate: string;
}

// --- Wirex 3D Secure ---
/**
 * A 3D Secure challenge waiting on the cardholder.
 *
 * When a merchant asks for 3DS, Wirex holds the transaction until it is approved
 * or declined — the user is standing at the terminal while it waits. `amount` is
 * a decimal string in `currency`'s major units ("127.15"): it comes off the wire
 * that way and is only ever formatted for display, never used in arithmetic.
 */
export interface WirexThreeDsRequest {
  /** Issuer transaction id — what the approve/decline calls are keyed on. */
  transactionId: string;
  cardId: string;
  cardLast4: string;
  amount: string;
  /** ISO 4217. */
  currency: string;
  merchantName: string;
}

export interface WirexThreeDsRequestsResponse {
  requests: WirexThreeDsRequest[];
  /**
   * The exact message the wallet must sign to approve, with `{nonce}` to be
   * replaced by the unix-seconds timestamp at signing time. From the backend so
   * the wording cannot drift from what Wirex verifies.
   */
  messageTemplate: string;
}

export enum WirexThreeDsDecisionOutcome {
  APPROVED = 'approved',
  DECLINED = 'declined',
  /**
   * The challenge is gone — it timed out at the terminal, or was already
   * decided. Not an error: the screen says so and refreshes.
   */
  EXPIRED = 'expired',
}

export interface WirexThreeDsDecisionResponse {
  transactionId: string;
  outcome: WirexThreeDsDecisionOutcome;
}

/**
 * A Wirex cardholder's `SolidCashModule` registration, as the backend reads it.
 *
 * A Wirex card is not prefunded like a Rain card. Wirex pays the merchant from its own
 * Master Account and our backend reimburses itself by debiting the user's Safe on each
 * settlement — so there is no card balance to top up, and the user's savings balance
 * *is* their card balance. What they grant instead is standing permission to take it,
 * bounded by the on-chain caps this describes.
 *
 * The chain is the source of truth — `SolidCashModule.isRegistered` and the Safe's own
 * module list decide whether spending works, not this record. The backend stores it so
 * the app, the sweep engine and support all see the same answer without each doing its
 * own multicall, and so a registration can be reconciled after the fact.
 *
 * Limits are decimal USD strings rather than numbers: they are 6-decimal on-chain
 * values and float rounding on a spending cap is not worth the convenience.
 */
export interface WirexCardRegistrationResponse {
  /** Both halves done: the module is enabled on the Safe *and* the Safe is registered. */
  registered: boolean;
  /**
   * The raw `isRegistered` flag, kept apart from {@link registered}.
   *
   * The two come apart in a state the UI has to handle differently: registration is
   * permanent (`registerSafe` reverts `AlreadyRegistered`, and there is no deregister)
   * but module consent can be withdrawn at any time. A Safe that registered and then
   * disabled the module is `registeredOnChain` yet not `registered`, and the fix is to
   * re-enable the module — not to register again, which cannot succeed.
   */
  registeredOnChain: boolean;
  /** Whether the module is enabled on the Safe. False once a user revokes consent. */
  moduleEnabled: boolean;
  /** Whether registration is offered at all in this environment. */
  available: boolean;
  /** The Safe's own daily cap, decimal USD. Null before registration. */
  dailyLimitUsd: string | null;
  /** The Safe's own monthly cap, decimal USD. Null before registration. */
  monthlyLimitUsd: string | null;
  /** Live org ceiling a Safe's daily cap is clamped to on every read. */
  maxDailyLimitUsd: string;
  /** Live org ceiling a Safe's monthly cap is clamped to on every read. */
  maxMonthlyLimitUsd: string;
  /** Applied when a Safe registers passing 0. */
  defaultDailyLimitUsd: string;
  defaultMonthlyLimitUsd: string;
  /** Hard cap on a single card transaction, independent of the rolling windows. */
  maxPerTxUsd: string;
  /** Headroom left under the tighter of the two windows right now. */
  limitRemainingUsd: string | null;
  /** Global guardian pause. Spending is off for everyone while true. */
  modulePaused: boolean;
  /** Per-Safe guardian pause — arrears or a fraud hold. */
  safePaused: boolean;
  /** `SolidCashModule` address the app must enable and register against. */
  moduleAddress: string;
  /** Chain the module lives on. Always Fuse (122). */
  chainId: number;
  /** Seconds from UTC the Safe's rolling windows reset at. Null before registration. */
  timezoneOffset: number | null;
  /**
   * What the card can spend right now, in decimal USD: the live on-chain figure less
   * anything already committed to a transaction Wirex has authorized but not settled.
   *
   * Null when the chain could not be read — a zero would read as "no money" rather
   * than "we do not know".
   */
  spendableUsd: string | null;
  /**
   * USD committed to authorizations Wirex has not settled yet, in decimal USD.
   *
   * The honest explanation for a spendable figure below the user's visible balance:
   * the money is still in the Safe, but it is already promised.
   */
  heldUsd: string;
  /**
   * Addresses the card may draw from, in the order settlements draw from them
   * (USDC, then USDT, then soUSD).
   *
   * From the backend rather than app config: the allowlist is on-chain state an admin
   * changes without a deploy, and the draw order is backend policy. A client-side copy
   * of either would go stale silently and mis-describe which of the user's assets gets
   * spent.
   */
  spendableTokens: string[];
}

/**
 * What the app tells the backend after a `registerSafe` user operation lands.
 *
 * None of it is trusted: the backend verifies the registration against the chain before
 * recording anything, and stores the chain's limits rather than these. They are sent so
 * a disagreement between what the app asked for and what the module holds is visible in
 * the logs, which it would not be if only one side were ever recorded.
 */
export interface WirexCardRegistrationConfirmRequest {
  transactionHash: string;
  dailyLimitUsd: string;
  monthlyLimitUsd: string;
  timezoneOffset: number;
}

// --- Rain contracts (funding) ---
export interface RainContractTokenDto {
  address: string;
  balance?: string;
  exchangeRate?: number;
  advanceRate?: number;
}

export interface RainOnrampBankDetailsDto {
  beneficiaryName: string;
  beneficiaryAddress: string;
  accountNumber: string;
  routingNumber: string;
  beneficiaryBankName?: string;
  beneficiaryBankAddress?: string;
}

export interface RainContractOnrampDto {
  ach?: RainOnrampBankDetailsDto;
  rtp?: RainOnrampBankDetailsDto;
  wire?: RainOnrampBankDetailsDto;
}

export interface RainContractResponseDto {
  id: string;
  chainId: number;
  controllerAddress: string;
  proxyAddress: string;
  tokens: RainContractTokenDto[];
  contractVersion: number;
  programAddress: string | null;
  depositAddress?: string;
  onramp?: RainContractOnrampDto;
}

/**
 * On-chain collateral held by one Rain collateral proxy, for ONE token.
 *
 * A proxy can hold several assets at once. Rain credits card spending power
 * against all of them, but a withdrawal moves a single named token, so each is
 * offered and capped separately.
 */
export interface CardCollateralTokenBalanceDto {
  rainCollateralContractId: string;
  chainId: number;
  collateralProxy: string;
  tokenAddress: string;
  /** ERC-20 symbol read on-chain, e.g. "USDC"/"USDT". Empty when unreadable. */
  symbol: string;
  decimals: number;
  /** Proxy's token balance in smallest units. */
  rawBalance: string;
  /** Same balance in dollars, floored to the cent. */
  balanceUsd: number;
  /** Set when the balance could not be read (RPC failure, unsupported chain). */
  unavailableReason?: string;
}

/**
 * GET /cards/collateral/available — what can actually be withdrawn from the
 * card to the wallet right now. Distinct from `CardBalanceResponseDto`, which
 * carries Rain's credit-side spending power: that figure can exceed the
 * collateral on-chain, and a withdrawal above this one is rejected.
 */
export interface CardCollateralAvailableDto {
  /** Withdrawable dollars for the default asset, floored to the cent. */
  availableUsd: number;
  /** `availableUsd` in the default token's smallest units. */
  availableRaw: string;
  /** On-chain collateral of the default asset, in dollars. */
  onChainCollateralUsd: number;
  /** On-chain collateral summed across every asset and contract, in dollars. */
  totalCollateralUsd: number;
  /** Rain's credit-side spending power, in dollars, when known. */
  spendingPowerUsd?: number;
  /** Which of the two caps is currently binding for the default asset. */
  limitedBy: 'collateral' | 'spendingPower' | 'none';
  /** Default asset a withdrawal draws from; absent when the user has none. */
  chainId?: number;
  collateralProxy?: string;
  tokenAddress?: string;
  symbol?: string;
  decimals?: number;
  /** Every collateral asset, richest first — the source for the asset picker. */
  tokens: CardCollateralTokenBalanceDto[];
}

export type OnrampAutomationRail = 'ach' | 'wire';

export interface OnrampAutomationDepositAddressDto {
  type: 'fiat';
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryBankName: string;
  beneficiaryBankAddress: string;
  accountNumber: string;
  routingNumber: string;
}

export interface OnrampAutomationSourceDto {
  currency: 'usd';
  rail: OnrampAutomationRail;
}

export interface OnrampAutomationDestinationDto {
  currency: string;
  rail: string;
  address: { type: 'onchain'; address: string };
}

export interface OnrampAutomationResponseDto {
  id: string;
  rainAutomationId: string;
  status: 'active' | 'deleted' | 'failed';
  source: OnrampAutomationSourceDto;
  destination: OnrampAutomationDestinationDto;
  depositAddress: OnrampAutomationDepositAddressDto;
  createdAt: string;
  updatedAt: string;
}

export enum LayerZeroTransactionStatus {
  INFLIGHT = 'INFLIGHT',
  CONFIRMING = 'CONFIRMING',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED',
  BLOCKED = 'BLOCKED',
  PAYLOAD_STORED = 'PAYLOAD_STORED',
  APPLICATION_BURNED = 'APPLICATION_BURNED',
  APPLICATION_SKIPPED = 'APPLICATION_SKIPPED',
  UNRESOLVABLE_COMMAND = 'UNRESOLVABLE_COMMAND',
  MALFORMED_COMMAND = 'MALFORMED_COMMAND',
}

export type LayerZeroTransaction = {
  data: {
    status: {
      name: LayerZeroTransactionStatus;
    };
    destination?: {
      tx?: {
        txHash: string;
      };
    };
  }[];
};

export enum TransactionType {
  DEPOSIT = 'deposit',
  UNSTAKE = 'unstake',
  WITHDRAW = 'withdraw',
  SEND = 'send',
  RECEIVE = 'receive', // Incoming token/native transfers from external sources
  BRIDGE = 'bridge',
  CANCEL_WITHDRAW = 'cancel_withdraw',
  BRIDGE_DEPOSIT = 'bridge_deposit',
  BORROW_AND_DEPOSIT_TO_CARD = 'borrow_and_deposit_to_card',
  CARD_DEPOSIT = 'card_deposit',
  BRIDGE_TRANSFER = 'bridge_transfer',
  BANK_TRANSFER = 'bank_transfer',
  CARD_TRANSACTION = 'card_transaction',
  CARD_WITHDRAWAL = 'card_withdrawal',
  MERCURYO_TRANSACTION = 'mercuryo_transaction',
  SWAP = 'swap',
  WRAP = 'wrap',
  UNWRAP = 'unwrap',
  MERKL_CLAIM = 'merkl_claim',
  CARD_WELCOME_BONUS = 'card_welcome_bonus',
  DEPOSIT_BONUS = 'deposit_bonus',
  FUND = 'fund',
  FAST_WITHDRAW = 'fast_withdraw',
  REPAY_AND_WITHDRAW_COLLATERAL = 'repay_and_withdraw_collateral',
  WITHDRAW_COLLATERAL = 'withdraw_collateral',
  RESCUE_TOKEN = 'rescue_token',
  AGENT_X402_PAYMENT = 'agent_x402_payment',
  AGENT_WALLET_DEPOSIT = 'agent_wallet_deposit',
  GOODDOLLAR_CLAIM = 'gooddollar_claim',
  GOODDOLLAR_SWEEP = 'gooddollar_sweep',
}

export enum TransactionDirection {
  IN = '+',
  OUT = '-',
  FAILED = '',
  CANCELLED = '⊘',
}

export enum TransactionCategory {
  SAVINGS_ACCOUNT = 'Savings account',
  FAST_WITHDRAW = 'Fast withdraw',
  WALLET_TRANSFER = 'Wallet transfer',
  EXTERNAL_WALLET_TRANSFER = 'External wallet transfer',
  BANK_DEPOSIT = 'Bank deposit',
  CARD_DEPOSIT = 'Card deposit',
  CARD_WITHDRAWAL = 'Card withdraw',
  REWARD = 'Reward',
  SEND = 'Send',
  SWAP = 'Swap',
  WRAP = 'Wrap',
  UNWRAP = 'Unwrap',
  MERKL_CLAIM = 'Merkl claim',
  CARD_WELCOME_BONUS = 'Card welcome bonus',
  DEPOSIT_BONUS = 'Deposit bonus',
  GOODDOLLAR_UBI = 'GoodDollar UBI',
  RECEIVE = 'Receive',
}

export enum TransactionStatus {
  PENDING = 'pending',
  DETECTED = 'detected',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
  TRANSFERRED_TO_SAFE = 'transferred_to_safe',
}

/**
 * Progress of a deposit, in order.
 * `received` means the transfer was seen on chain but is not confirmed yet
 * (unconfirmed webhook). `detected` is the legacy alias for it.
 */
export type DepositStep = 'received' | 'confirmed' | 'depositing' | 'minting' | 'complete';

export type Transaction = {
  title: string;
  shortTitle?: string;
  timestamp: string;
  amount: string;
  status: TransactionStatus;
  chainId?: number;
  hash?: string;
  url?: string;
  type: TransactionType;
  symbol: string;
  fromAddress?: string;
  toAddress?: string;
  sourceDepositInstructions?: SourceDepositInstructions;
  trackingId?: string;
  failureReason?: string;
};

export type Faq = {
  question: string;
  answer: string;
};

export type StatusInfo = {
  status: Status;
  message?: string;
};

export type DepositModal = (typeof DEPOSIT_MODAL)[keyof typeof DEPOSIT_MODAL];
export type SendModal = (typeof SEND_MODAL)[keyof typeof SEND_MODAL];
export type SwapModal = (typeof SWAP_MODAL)[keyof typeof SWAP_MODAL];
export type WithdrawModal = (typeof WITHDRAW_MODAL)[keyof typeof WITHDRAW_MODAL];
export type UnstakeModal = (typeof UNSTAKE_MODAL)[keyof typeof UNSTAKE_MODAL];
export type StakeModal = (typeof STAKE_MODAL)[keyof typeof STAKE_MODAL];
export type DepositFromSafeAccountModal =
  (typeof DEPOSIT_FROM_SAFE_ACCOUNT_MODAL)[keyof typeof DEPOSIT_FROM_SAFE_ACCOUNT_MODAL];

/**
 * Why the savings direct-deposit flow was opened.
 *
 * `card_deposit` is the Bangladesh card gate ("Deposit at least $5"), which
 * completes off the soUSD balance alone — so that entry point only offers the
 * stablecoins that mint soUSD.
 */
export type SavingsFundIntent = 'savings' | 'card_deposit';

export type TransactionStatusModal = {
  amount?: number;
  address?: Address;
  trackingId?: string;
  symbol?: string;
};

export type TokenIcon = {
  type: 'image' | 'component';
  source?: any;
  component?: React.ReactNode;
};

export type Explorers = {
  blockscout?: string;
  etherscan?: string;
  layerzeroscan?: string;
  lifiscan?: string;
};

export enum SavingMode {
  TOTAL = 'total',
  TOTAL_USD = 'total-usd',
  INTEREST_ONLY = 'interest-only',
  BALANCE_ONLY = 'balance-only',
  CURRENT = 'current',
  ALL_TIME = 'all-time',
}

export type BridgeDeposit = {
  srcToken: string;
  eoaAddress: Address;
  srcChainId: number;
  amount: string;
  permitSignature?: {
    v: number;
    r: string;
    s: string;
    deadline: number;
  };
  trackingId?: string;
  category?: DepositCategory;
};

export type BridgeTransactionRequest = {
  eoaAddress: Address;
  srcChainId: number;
  amount: string;
  toAmount?: string;
  fromAmount?: string;
  toAmountMin?: string;
  bridgeTxHash: Address;
};

export type Deposit = {
  eoaAddress: Address;
  amount: string;
  permitSignature?: {
    v: number;
    r: string;
    s: string;
    deadline: number;
  };
  trackingId?: string;
  vault?: VaultType;
  category?: DepositCategory;
};

export enum DepositCategory {
  SAVINGS = 'SAVINGS',
  CARD = 'CARD',
}

export enum DepositTransactionStatus {
  PENDING = 'pending',
  FAILED = 'failed',
  PERMIT_COMPLETED = 'permit_completed',
  TRANSFER_COMPLETED = 'transfer_completed',
  DEPOSIT_INITIATED = 'deposit_initiated',
  DEPOSIT_COMPLETED = 'deposit_completed',
  DEPOSIT_FAILED = 'deposit_failed',
}

export interface DepositTransaction {
  amount: string;
  decimals: number;
  depositTxHash?: string;
  status: DepositTransactionStatus;
  createdAt: Date;
  trackingId?: string;
  errorMessage?: string;
}

export enum BridgeTransactionStatus {
  PENDING = 'pending',
  FAILED = 'failed',
  PERMIT_COMPLETED = 'permit_completed',
  TRANSFER_COMPLETED = 'transfer_completed',
  APPROVAL_COMPLETED = 'approval_completed',
  BRIDGE_INITIATED = 'bridge_initiated',
  BRIDGE_COMPLETED = 'bridge_completed',
  BRIDGE_FAILED = 'bridge_failed',
  DEPOSIT_INITIATED = 'deposit_initiated',
  DEPOSIT_COMPLETED = 'deposit_completed',
  DEPOSIT_FAILED = 'deposit_failed',
}

export enum BankTransferStatus {
  AWAITING_FUNDS = 'awaiting_funds',
  FUNDS_RECEIVED = 'funds_received',
  PAYMENT_PROCESSED = 'payment_processed',
}

export type BankTransferPaymentRail = 'ach_push' | 'wire' | 'sepa' | 'spei' | 'fps';

export interface BankTransferListItemDto {
  id: string;
  amount: string; // decimal string
  currency: string; // e.g., "usd", "eur"
  payment_rail: BankTransferPaymentRail;
  state: BankTransferStatus;
  created_at: string; // ISO string
  updated_at?: string; // ISO string
  url?: string;
}

export type GetBankTransfersResponseDto = BankTransferListItemDto[];

// Normalized bank transfer item used by the Activity feed (frontend)
export type BankTransferActivityItem = {
  id: string;
  amount: number;
  currency: string;
  method: BankTransferPaymentRail;
  status: BankTransferStatus;
  timestamp: number; // unix seconds
  url?: string;
  sourceDepositInstructions?: SourceDepositInstructions;
};

export interface BridgeTransaction {
  srcChainId: number;
  dstChainId: number;
  fromAmount: string;
  toAmount: string;
  decimals: number;
  bridgeTxHash?: string;
  depositTxHash?: string;
  status: BridgeTransactionStatus;
  createdAt: Date;
  trackingId?: string;
  errorMessage?: string;
}

export enum ActivityTab {
  /** Wallet and card activity in one feed — the Activity screen's default. */
  ALL = 'all',
  WALLET = 'wallet',
  PROGRESS = 'progress',
  CARD = 'card',
}

export enum CashbackStatus {
  Pending = 'Pending',
  Escrowed = 'Escrowed',
  Paid = 'Paid',
  DeductedFromDebt = 'DeductedFromDebt',
  PartiallyRefunded = 'PartiallyRefunded',
  FullyRefunded = 'FullyRefunded',
  Canceled = 'Canceled',
  Failed = 'Failed',
  PermanentlyFailed = 'PermanentlyFailed',
}

export interface Cashback {
  _id: string;
  transactionId: string;
  status: CashbackStatus;
  /** soUSD payout amount (6dp) and the soUSD/USD rate used at payout. */
  soUsdAmount?: string;
  soUsdRate?: string;
  /** @deprecated legacy FUSE fields for cashbacks paid before the soUSD migration */
  fuseAmount?: string;
  fuseUsdPrice?: string;
  fiatAmount?: string;
  fiatCurrency?: string;
  payoutAt?: string;
  createdAt: string;
}

export interface CashbackInfo {
  amount: string;
  isPending: boolean;
  isEscrowed: boolean;
  payoutAt?: string;
}

export interface SourceDepositInstructions {
  payment_rail: string;
  currency: string;
  amount: string;
  deposit_message: string;
  bank_name: string;
  bank_address?: string;

  // ACH/Wire fields
  bank_account_number?: string;
  bank_routing_number?: string;
  bank_beneficiary_name?: string;
  bank_beneficiary_address?: string;

  // SEPA fields
  iban?: string;
  bic?: string;
  account_holder_name?: string;

  // SPEI fields
  clabe?: string;

  // PIX fields
  qr_code?: string;
  br_code?: string;
  expires_at?: string;
}

export enum TokenType {
  ERC20 = 'ERC-20',
  NATIVE = 'native',
}

export interface TokenBalance {
  contractTickerSymbol: string;
  contractName: string;
  contractAddress: string;
  balance: string;
  quoteRate?: number;
  logoUrl?: string;
  contractDecimals: number;
  type: TokenType;
  verified?: boolean;
  chainId: number;
  tokenIcon?: TokenIcon;
  commonId?: string;
  tokenId?: string;
}

export enum RewardsType {
  DEPOSIT = 'holding_deposited_funds',
  REFERRAL_SIGNUP = 'referral_signup',
  RECURRING_REFERRAL = 'recurring_referral',
  DAILY_LOGIN = 'daily_login',
}

export enum FromCurrency {
  EUR = 'eur',
  USD = 'usd',
  BRL = 'brl',
  MXN = 'mxn',
  GBP = 'gbp',
}

export enum ToCurrency {
  USD = 'usd',
}

export interface ExchangeRateResponse {
  midmarket_rate: string;
  buy_rate: string;
  sell_rate: string;
}

export interface Points {
  nextRewardTime: number;
  pointsLast24Hours: number;
  userRewardsSummary: {
    totalPoints: number;
    rewardsByType: {
      type: RewardsType;
      count: number;
      totalPoints: number;
    }[];
    referredUsersCount?: number;
    referredUsersDepositedCount?: number;
  };
  userRefferer: string;
  leaderboardPosition?: number;
}

export enum RewardsTier {
  CORE = 'core',
  PRIME = 'prime',
  ULTRA = 'ultra',
}

export interface RewardsUserData {
  currentTier: RewardsTier;
  totalPoints: number;
  nextTierPoints: number;
  nextTier: RewardsTier | null;
  cashbackRate: number;
  cashbackThisMonth: number;
  /**
   * Cashback earned this month that is still escrowed, in USD, already trimmed
   * to what the monthly cap can still pay out.
   *
   * Cashback settles days after the purchase, so `cashbackThisMonth` alone reads
   * as $0 to someone who just spent — this is the rest of that answer. A
   * projection, not a settled figure: absent on older backends, which is what
   * hides every pending label.
   */
  cashbackPendingThisMonth?: number;
  maxCashbackMonthly: number;
  /** Whether the user has joined the new rewards program. */
  hasOptedIn?: boolean;
  /** The user's old Solid Points total prior to conversion. */
  legacyPoints?: number;
  /** Legacy Carryover Credit granted from old points under the new economy. */
  legacyCarryoverPoints?: number;
  /** Tier the user starts in after carryover is applied (Core or Prime). */
  startingTier?: RewardsTier;
  /**
   * Extra APY the current tier adds on top of the base savings yield, in
   * percentage points. 0 (or absent) means the tier grants no boost, which is
   * what hides the yield boost benefit card and the savings boost strip.
   */
  yieldBoostPercentage?: number;
  /** Ceiling on yield boost payouts for the current tier, in USD. */
  yieldBoostCap?: number;
  /** Yield boost payouts the user has already received, in USD. */
  yieldBoostEarned?: number;
  /**
   * Cashback % the current tier earns back on eligible subscriptions. 0 (or
   * absent) means the tier grants none, which hides the subscription card.
   */
  subscriptionDiscountRate?: number;
  /** Subscription categories the current tier earns the discount on per month. */
  subscriptionCategoryLimit?: number;
  /**
   * FUSE-in-savings tier unlock ("skip the line"). Absent on older backends,
   * which is what hides the section.
   */
  fuseSkipLine?: FuseSkipLine;
}

/** One "skip the line" rung: what a tier costs in FUSE and how close the user is. */
export interface FuseSkipLineTier {
  tier: RewardsTier;
  /** FUSE that must sit in the soFUSE vault to hold this tier. */
  requiredFuse: number;
  /** Whether the user's current FUSE balance meets the threshold. */
  unlocked: boolean;
  /** FUSE still needed to reach the threshold (0 once unlocked). */
  remainingFuse: number;
  /** Progress toward this tier's threshold, 0-100. */
  progressPct: number;
}

/**
 * "Skip the line": FUSE held in savings unlocks a membership tier outright,
 * bypassing the points ladder. The tier is held only while the balance stays
 * above the threshold.
 */
export interface FuseSkipLine {
  /** Whether the mechanic is switched on. False hides the section. */
  enabled: boolean;
  /** The user's soFUSE position, denominated in FUSE. */
  balanceFuse: number;
  /** That same position in USD, for the secondary label. */
  balanceUsd: number;
  /** Highest tier the FUSE balance unlocks on its own (core when none). */
  unlockedTier: RewardsTier;
  /** The purchasable rungs, cheapest first. */
  tiers: FuseSkipLineTier[];
}

export interface TierBenefit {
  title: string;
  subtitle?: string;
  image?: string;
}

/** One row of the tier screen's "Fees & Caps" table. */
export interface TierFeeLine {
  /**
   * Stable row key: a FeeProduct value ('swap' | 'fx' | 'offramp' |
   * 'bank_deposit'), or 'virtual_card' for the row with no fee behind it.
   */
  key: string;
  label: string;
  /** Rate as a fraction (0.005 = 0.5%). 0 when this tier pays nothing. */
  rate: number;
  /** Pre-rendered value: 'Free' when the rate is 0, else '0.5%'. */
  value: string;
}

/**
 * The "Fees & Caps" block for one tier.
 *
 * Values arrive pre-rendered from the same config the charge engine bills from,
 * so the table can't promise "Free" while a fee is being charged, and the three
 * tier tabs can't round the same rate differently.
 */
export interface TierFees {
  lines: TierFeeLine[];
  cashbackCap: string;
  /** FUSE that must be staked to hold this tier outright. 0 when none is. */
  fuseUnlockAmount: number;
  /** Rendered requirement, e.g. 'Not required' or '400,000 FUSE'. */
  fuseUnlock: string;
  /** True when every fee on this tier is zero — the Ultra promise. */
  allFree: boolean;
  /** Copy under the table, absent on a tier that already pays nothing. */
  footnote?: string;
}

export interface TierBenefits {
  tier: RewardsTier;
  depositBoost: TierBenefit;
  /** `depositBoost` as APY percentage points (0 when the tier has no boost). */
  yieldBoostPercentage?: number;
  /** Ceiling on yield boost payouts for this tier, in USD. */
  yieldBoostCap?: number;
  cardCashback: TierBenefit;
  subscriptionDiscount: TierBenefit | null;
  cardCashbackCap: TierBenefit;
  subscriptionDiscountCap: TierBenefit | null;
  cardFees: TierBenefit;
  bankDeposit: TierBenefit;
  swapFees: TierBenefit;
  support: TierBenefit;
  /**
   * Everything the "Fees & Caps" card needs, in one block.
   *
   * Optional because a client can outlive the backend that serves it — a build
   * pointed at an older API renders the legacy rows rather than an empty card.
   */
  fees?: TierFees;
}

export interface TierBenefitItem {
  icon: string;
  title: string;
  description: string;
}

// Rewards Config Types (from backend)
export interface TierThresholds {
  tier1: { min: number; max: number };
  tier2: { min: number; max: number };
  tier3: { min: number };
}

export interface TierCashbackConfig {
  percentage: number;
  monthlyCap: number;
}

export interface TierSubscriptionDiscountConfig {
  percentage: number;
  /** @deprecated Superseded by categoryLimit. */
  serviceLimit: number;
  /** Number of subscription categories this tier can earn a discount on per month. */
  categoryLimit: number;
}

export interface SubscriptionDiscountCategory {
  key: string;
  label: string;
  merchants: string[];
}

export interface CashbackConfig {
  enabled: boolean;
  settlementDays: number;
  tier1: TierCashbackConfig;
  tier2: TierCashbackConfig;
  tier3: TierCashbackConfig;
}

export interface SubscriptionDiscountConfig {
  enabled: boolean;
  /** @deprecated Legacy flat service list; detection uses categories. */
  eligibleServices: string[];
  categories: SubscriptionDiscountCategory[];
  /** First N dollars of an eligible charge that earn the discount. */
  eligibleAmountCap: number;
  tier1: TierSubscriptionDiscountConfig;
  tier2: TierSubscriptionDiscountConfig;
  tier3: TierSubscriptionDiscountConfig;
}

export interface FuseStakingConfig {
  /** Master switch for the "skip the line" FUSE tier unlock. */
  enabled: boolean;
  /** FUSE that must sit in the soFUSE vault to hold Prime. */
  tier2Amount: number;
  /** FUSE that must sit in the soFUSE vault to hold Ultra. */
  tier3Amount: number;
}

export interface ReferralConfig {
  recurringEnabled: boolean;
  boostEnabled: boolean;
  recurringPercentage: number;
  boostPercentage: number;
}

export interface PointsEarningConfig {
  cardSpendEnabled: boolean;
  swapEnabled: boolean;
  holdingFundsEnabled: boolean;
  /** Whether points accrue on the balance held on the card. */
  cardBalanceEnabled?: boolean;
  cardSpendPointsPerDollar: number;
  swapPointsPerDollar: number;
  /** Points per $1 of deposited funds, per HOUR. */
  holdingFundsMultiplier: number;
  /** Points per $1 of card balance held, per HOUR. */
  cardBalancePointsPerDollarPerHour?: number;
}

export interface FullRewardsConfig {
  /** Master switch: when false, all users are treated as Core for benefits. */
  tierSystemLive?: boolean;
  tiers: TierThresholds;
  points: PointsEarningConfig;
  cashback: CashbackConfig;
  subscriptionDiscount: SubscriptionDiscountConfig;
  fuseStaking: FuseStakingConfig;
  referral: ReferralConfig;
}

/** Products Solid charges a per-tier fee on. Mirrors the backend FeeProduct. */
export enum FeeProduct {
  SWAP = 'swap',
  FX = 'fx',
  /** Bank withdrawal. Stored under its original `offramp` name. */
  BANK_WITHDRAWAL = 'offramp',
  BANK_DEPOSIT = 'bank_deposit',
}

/** The fee rates the signed-in user currently pays, from their live tier. */
export interface ProductFeeRates {
  tier: number;
  tierName: string;
  /** Rate per product, as fractions. 0 means this user pays nothing. */
  rates: Record<FeeProduct, number>;
  /** Fees computing below this (USD) are not charged at all. */
  minChargeUsd: number;
  /**
   * Where an on-chain swap fee must be sent.
   *
   * Absent when the revenue wallet is unconfigured, which the client must treat
   * as "do not collect a swap fee": appending a transfer to a zero or guessed
   * address would burn the user's money.
   */
  revenueWalletAddress?: string;
}

/** What the user will pay on one specific amount. */
export interface ProductFeeQuote {
  product: FeeProduct;
  tier: number;
  tierName: string;
  percentage: number;
  feeAmountUsd: string;
  waiveReason?: string;
}

export interface RecordSwapFeeParams {
  transactionHash: string;
  baseAmountUsd: number;
  feeTokenAddress: string;
  feeTokenSymbol?: string;
  feeTokenAmount: string;
  feeAmountUsd: number;
  percentage?: number;
}

export enum LifiOrder {
  FASTEST = 'FASTEST',
  CHEAPEST = 'CHEAPEST',
}

export interface GetLifiQuoteParams {
  fromAddress: string;
  fromChain: number;
  fromToken?: string;
  fromAmount: bigint;
  toAddress: string;
  toChain?: number;
  toToken?: string;
  order?: LifiOrder;
}

export interface LifiQuoteResponse {
  id: string;
  type: string;
  tool: string;
  action: {
    fromToken: {
      address: string;
      chainId: number;
      decimals: number;
      symbol: string;
    };
    toToken: {
      address: string;
      chainId: number;
      decimals: number;
      symbol: string;
    };
    fromAmount: string;
    toAmount: string;
  };
  estimate: {
    approvalAddress: string;
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    feeCosts: any[];
    gasCosts: any[];
  };
  transactionRequest: {
    from: string;
    to: string;
    data: Hex;
    value: bigint;
    gasLimit: bigint;
    gasPrice: bigint;
  };
}

export enum LifiStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export interface LifiStatusResponse {
  status: LifiStatus;
  substatusMessage: string;
  sending: {
    amount: string;
  };
  receiving: {
    amount: string;
  };
}

export interface SignupUser {
  username: string;
  inviteCode?: string;
}

export interface LocalTransactionDetails {
  amount: string;
  currency: string;
  exchange_rate: string;
}

export interface CryptoTransactionDetails {
  from_address: string;
  to_address: string;
  tx_hash: string;
  chain: string;
}

/** Fee categories the card can charge. Swaps are not one: they happen off-card. */
export enum CardFeeCategory {
  /** Purchase that settled in a currency other than the card's own. */
  FX = 'fx',
  /** Funds moved off the card. */
  OFF_RAMP = 'offramp',
}

export enum CardFeeStatus {
  Pending = 'Pending',
  Charged = 'Charged',
  Failed = 'Failed',
  PermanentlyFailed = 'PermanentlyFailed',
  /** Nothing was owed — see `waive_reason`. */
  Waived = 'Waived',
}

export enum CardFeeWaiveReason {
  /** The user's tier pays 0% here (Ultra, or a zeroed rate). */
  TierFree = 'TierFree',
  /** The fee rounded below the minimum worth charging. */
  BelowMinimum = 'BelowMinimum',
  /** The fee program, or this category, is switched off. */
  Disabled = 'Disabled',
}

/**
 * A fee applied to a card transaction.
 *
 * Waived fees are returned too: "FX fee — waived on Ultra" is where the tier
 * pays for itself, and hiding the $0 line would make the fee look like it
 * appeared out of nowhere if the user ever drops a tier.
 */
export interface CardTransactionFee {
  category: CardFeeCategory | string;
  /** Ready-to-show label from the backend, e.g. "FX fee". */
  label: string;
  /** USD, 2dp. "0.00" when waived. */
  amount: string;
  currency: string;
  /** Rate applied as a fraction (0.0099 = 0.99%). */
  percentage: number;
  status: CardFeeStatus | string;
  waive_reason?: CardFeeWaiveReason | string;
  /** Tier the fee was rated at: 'core' | 'prime' | 'ultra'. */
  tier: string;
}

export enum CardTransactionCategory {
  ADJUSTMENT = 'adjustment',
  PURCHASE = 'purchase',
  REFUND = 'refund',
  WITHDRAWAL = 'withdrawal',
  CRYPTO_FUNDING = 'crypto_funding',
  CRYPTO_WITHDRAWAL = 'crypto_withdrawal',
}

/**
 * What our backend's own ledger knows about a card transaction, beyond what the
 * issuer reports.
 *
 * Only present for cards that spend against savings rather than a prefunded
 * balance (Wirex): the issuer settles from its Master Account and we reimburse it
 * by pulling soUSD from the user's Safe on Fuse. That pull is the transaction the
 * user's own money actually went through, and the issuer has no record of it.
 */
export interface CardSpendDetails {
  /** Hash of the soUSD pull (a debit) or refund (a credit), on Fuse. */
  sweep_tx_hash?: string;
  /** Chain the sweep settled on. Fuse (122) — NOT the issuer's chain. */
  chain_id?: number;
  /** soUSD moved, as a decimal string. */
  so_usd_amount?: string;
  /** USD per soUSD share used to size the claim. */
  so_usd_rate?: number;
  /** The transaction converted to USD. */
  usd_amount?: number;
  /** USD per unit of the transaction currency (1 for USD). */
  usd_rate?: number;
  /** `held` | `settled` | `released` | `failed` — where the claim stands. */
  state?: string;
  settled_at?: string;
  decline_reason?: string;
}

export interface CardTransaction {
  id: string;
  card_account_id: string;
  customer_id: string;
  category: CardTransactionCategory;
  amount: string;
  currency: string;
  status: string;
  description: string;
  posted_at: string;
  authorized_at: string;
  crypto_transaction_details?: CryptoTransactionDetails;
  related_transaction_ids: string[];
  billing_amount?: string;
  merchant_category_code?: string;
  merchant_name?: string;
  merchant_location?: string;
  merchant_city?: string;
  merchant_country?: string;
  local_transaction_details?: LocalTransactionDetails;
  /**
   * What the transaction was worth in USD, when `currency` is not already a
   * dollar. The opposite of `local_transaction_details`: that is a USD card
   * reporting a foreign charge, this is a foreign charge reported in USD.
   */
  usd_amount?: string;
  declined_reason?: string;
  /**
   * A merchant category already written as a label ("Online Shopping"), for
   * issuers that name the category instead of sending a numeric MCC. Wirex does;
   * `getMerchantCategory` has nothing to resolve there, so this is shown instead.
   */
  merchant_category_label?: string;
  /**
   * How much of this transaction has been refunded, when the issuer models a
   * refund as a credit on the original transaction rather than a separate one
   * (Wirex does). `amount` is already net of it — this exists to explain why the
   * figure is lower than what the merchant charged.
   */
  refunded_amount?: string;
  /** Fees applied to this transaction. Absent when none were evaluated. */
  fees?: CardTransactionFee[];
  /**
   * Our ledger's view of the same transaction. Returned by the single-transaction
   * read only, so it is available on the detail screen and not in the list.
   */
  spend_details?: CardSpendDetails;
}

/** What the activity surfaces need to render a fee, derived from `fees`. */
export interface CardFeeInfo {
  /** Signed display amount, e.g. "-$0.99". "Free" when waived. */
  amount: string;
  /** Row label, e.g. "FX fee". */
  label: string;
  /** True when nothing was charged. */
  isWaived: boolean;
  /** True while the charge is still owed (pending or being retried). */
  isPending: boolean;
  /** "0.99%" — the rate the fee was charged at. Empty when waived. */
  rate: string;
  /** Explains a waived fee, e.g. "Waived on Ultra". */
  waivedNote?: string;
}

export interface CardTransactionsResponse {
  page: number;
  count: number;
  total_pages: number;
  total_count: number;
  page_size: number;
  pagination_token?: string;
  data: CardTransaction[];
}

export enum PromiseStatus {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

export interface LeaderboardUser {
  id: string;
  walletAddress: string;
  points: number;
  leaderboardPosition: number;
  walletAgeInDays?: number;
}

export interface LeaderboardResponse {
  users: LeaderboardUser[];
}

export interface ActivityEventMetadata {
  description: string;
  source: string;
}

export interface ActivityEvent {
  clientTxId: string;
  title: string;
  shortTitle?: string;
  timestamp: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  symbol: string;
  chainId?: number;
  hash?: string;
  userOpHash?: string;
  fromAddress?: string;
  toAddress?: string;
  url?: string;
  requestId?: Hex;
  sourceDepositInstructions?: SourceDepositInstructions;
  metadata?: Record<string, any>;
  deleted?: boolean;
  deletedAt?: string;
  failureReason?: string;
}

export interface ActivityEvents {
  docs: ActivityEvent[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
  nextPage: number | null;
  page: number;
  pagingCounter: number;
  prevPage: number | null;
  totalDocs: number;
  totalPages: number;
}

export interface UpdateActivityEvent {
  status?: TransactionStatus;
  hash?: string;
  url?: string;
  userOpHash?: string;
  metadata?: Record<string, any>;
}

// Sync activities from Blockscout
export interface SyncActivitiesOptions {
  chainIds?: number[];
  direction?: 'from' | 'to' | 'all';
  type?: 'token' | 'native' | 'all';
}

export interface SyncActivitiesResponse {
  synced: number;
  skipped: number;
  errors: number;
  message: string;
}

export interface VaultBreakdown {
  name: string;
  title?: string;
  type: string;
  image?: string;
  link?: string;
  expiryDate: string;
  amountUSD: number;
  allocation: number;
  effectivePositionAPY: number;
  positionMaxAPY: number;
  risk: string;
  chain: string;
}

// Card Details Reveal Types
export interface EphemeralKeyResponse {
  ephemeral_key: string;
}

export interface CardDetailsRevealResponse {
  card_number: string;
  card_security_code: string;
  expiry_date: string;
}

export interface ClientNonceData {
  clientSecret: string;
  clientTimestamp: number;
  nonce: string;
}

// Stargate API interfaces
export interface StargateQuoteParams {
  srcToken: string;
  srcChainKey: string;
  dstToken: string;
  dstChainKey: string;
  srcAddress: string;
  dstAddress: string;
  srcAmount: string;
  dstAmountMin: string;
}

export interface StargateTransaction {
  data: string;
  to: string;
  value: string;
  from: string;
}

export interface StargateStep {
  type: string;
  sender: string;
  chainKey: string;
  transaction: StargateTransaction;
}

export interface StargateFee {
  token: string;
  chainKey: string;
  amount: string;
  type: string;
}

export interface StargateDuration {
  estimated: number;
}

export interface StargateQuote {
  route: string;
  error: string | null;
  srcAmount: string;
  dstAmount: string;
  srcAmountMax: string;
  dstAmountMin: string;
  srcToken: string;
  dstToken: string;
  srcAddress: string;
  dstAddress: string;
  srcChainKey: string;
  dstChainKey: string;
  dstNativeAmount: string;
  duration: StargateDuration;
  fees: StargateFee[];
  steps: StargateStep[];
}

export interface StargateQuoteResponse {
  quotes: StargateQuote[];
}

export type MerklRewards = Reward['rewards'];
export type MerklReward = MerklRewards[0];

export enum ActivityGroup {
  HEADER = 'header',
  TRANSACTION = 'transaction',
}

export interface APYs {
  allTime: number;
  sevenDay: number;
  fifteenDay: number;
  thirtyDay: number;
}

export interface TotalAPYResponse {
  usdc: number;
  fuse: number;
  eth: number;
}

export interface APYsByAsset {
  usdc: APYs;
  fuse: APYs;
  eth: APYs;
}

export interface HistoricalAPYPoint {
  time: string;
  value: number;
}

export interface Coin {
  id: string;
  name: string;
  api_symbol: string;
  symbol: string;
}

export interface SearchCoin {
  coins: Coin[];
}

export interface CoinHistoricalChart {
  prices: [number, number][];
}

export interface ChartPayload {
  time: number | string;
  value: number;
}

export interface SwapTokenRequest {
  chainId?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  symbol?: string;
  address?: string;
  limit?: number;
  offset?: number;
}

export interface SwapTokenResponse {
  _id: string;
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  isActive: boolean;
  displayOrder?: number;
  isFeatured: boolean;
  commonId?: string;
  tokenId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddressBookRequest {
  name?: string;
  walletAddress: string;
  skip2fa?: boolean;
}

export interface AddressBookResponse {
  name?: string;
  walletAddress: string;
  skipped2faAt?: Date;
}

export type AgentSummary = {
  agentEoaAddress?: string;
};

export type AgentApiKeySummary = {
  id: string;
  prefix: string;
  name?: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type GenerateAgentApiKeyResponse = AgentApiKeySummary & { key: string };

/**
 * Envelope returned by the Turnkey SDK's `stampX` methods. `body` is the
 * exact stringified bytes the SDK signed — we MUST forward it verbatim;
 * re-serializing on the server changes key order and breaks the stamp.
 */
export type SignedTurnkeyRequest = {
  url: string;
  body: string;
  stamp: { stampHeaderName: string; stampHeaderValue: string };
};

export type ProvisioningActivity = {
  url: string;
  body: Record<string, unknown>;
};

export type ProvisioningInitResponse = {
  provisioningId: string;
  subOrganizationId: string;
  /**
   * Set when the agent's wallet path was already derived in Turnkey from a
   * prior failed provisioning attempt. The `activity` in this case is the
   * createUsers body — the client should skip the wallet-account stamp.
   */
  agentEoaAddress?: string;
  activity: ProvisioningActivity;
};

export type ProvisioningStepInput = {
  provisioningId: string;
  signed: SignedTurnkeyRequest;
};

export interface WhatsNewStep {
  imageUrl: string;
  title: string;
  text: string;
  buttonLabel?: string;
  buttonLink?: string;
}

export interface WhatsNew {
  _id: string;
  steps: WhatsNewStep[];
  isActive: boolean;
  showOnLoad: boolean;
  createdAt: string;
}

export interface PromotionsBannerPlatforms {
  web: boolean;
  android: boolean;
  ios: boolean;
}

export interface PromotionsBannerItem {
  imageURL: string;
  mobileImageURL?: string;
  slug: string;
  sort: number;
  link?: string;
  platforms?: PromotionsBannerPlatforms;
  /**
   * Native app version gate set in the admin dashboard, e.g. '>=2.0.0' (that
   * build and every newer one) or '1.0.12' (only that build). Absent means
   * every version. Web ignores it — it always serves the latest build.
   */
  version?: string;
  /**
   * Pathname the banner is scoped to, e.g. '/' (home/wallet) or '/savings'.
   * Absent means every page.
   */
  page?: string;
}

export type PromotionsBannerResponse = PromotionsBannerItem[];

// SSE Activity Stream Types
export interface SSEPingData {
  timestamp: number;
}

export interface SSEActivityData {
  event: 'created' | 'updated' | 'deleted';
  userId: string;
  activity: ActivityEvent;
  timestamp: number;
}

export type BalanceChangeType =
  | 'deposit'
  | 'withdrawal'
  | 'transfer_in'
  | 'transfer_out'
  | 'swap'
  | 'bonus';

export interface SSEBalanceUpdateData {
  event: 'balance_update';
  userId: string;
  balance: {
    shouldRefetch: true;
    changeType: BalanceChangeType;
    triggerActivityId?: string;
  };
  timestamp: number;
}

export type SSEEventData =
  | { type: 'ping'; data: SSEPingData }
  | { type: 'activity'; data: SSEActivityData }
  | { type: 'balance_update'; data: SSEBalanceUpdateData };

// SSE Connection States
export type SSEConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// Webhook Status Types
export interface WebhookStatus {
  registered: boolean;
  registeredChains: number[];
  registeredAt: Date | null;
  availableChains: number[];
}

export interface EnsureWebhookResponse {
  success: boolean;
  alreadySubscribed: boolean;
  registeredChains: number[];
  failedChains: number[];
  message: string;
}

export type DepositMethod =
  | 'wallet'
  | 'deposit_directly'
  | 'credit_card'
  | 'bank_transfer'
  | 'buy_crypto';

// -----------------------------------------------------------------------------
// TransFi buy-crypto onramp
// -----------------------------------------------------------------------------

/** Buy-crypto gating status returned by GET /accounts/v1/transfi/status. */
export type TransfiBuyCryptoStatus = 'ready' | 'can_share' | 'needs_kyc' | 'pending' | 'rejected';

export interface TransfiStatusResponse {
  status: TransfiBuyCryptoStatus;
  transfiKycStatus?: string;
  reasons?: string[];
  /**
   * On `rejected`, whether TransFi will let the user resubmit through its hosted
   * KYC. False for compliance rejections, where retrying is pointless — the
   * screen offers a retry only when this is true.
   */
  canRetryKyc?: boolean;
  /**
   * On `needs_kyc`, the identity provider this user's jurisdiction routes to.
   * Resolved from the backend's country rules; the client's own country signal
   * (from the geo store) takes precedence when it has one.
   */
  kycProvider?: KycProvider;
}

/**
 * Result of POST /transfi/kyc/retry: the gating status, plus the hosted KYC page
 * to open when TransFi granted one.
 */
export interface TransfiKycRetryResponse extends TransfiStatusResponse {
  kycUrl?: string;
}

export interface TransfiPaymentMethodOption {
  paymentCode: string;
  paymentName?: string;
  paymentType?: string;
  logo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface TransfiCurrencyOption {
  currency: string;
  logoUrl?: string;
}

export interface TransfiPaymentConfig {
  currencies: TransfiCurrencyOption[];
  defaultCurrency: string;
  tokenSymbol: string;
  tokenLogo?: string;
  /** Chain the bought USDC is delivered on, e.g. 'Base'. */
  tokenNetwork?: string;
  /**
   * Which delivery route the purchase takes: 'card_funding' straight onto a Rain
   * card, 'card_direct_deposit' to a Wirex cardholder's card deposit address
   * (from where the direct-deposit pipeline carries it to their Safe on Fuse),
   * 'safe' when there is no card to fund.
   */
  destinationType?: 'card_funding' | 'card_direct_deposit' | 'safe';
}

export interface TransfiQuote {
  fiatCurrency: string;
  cryptoCurrency: string;
  usdcAmount: string;
  paymentCode: string;
  exchangeRate?: number;
  totalFee?: number;
  fiatAmount?: number;
  minLimit?: number;
  maxLimit?: number;
}

export interface TransfiFeeData {
  depositAmount?: number;
  withdrawAmount?: number;
  exchangeRate?: number;
  totalFee?: number;
  [key: string]: unknown;
}

export interface TransfiCreateOrderResponse {
  orderId: string;
  payUrl?: string;
  status: string;
  feeData?: TransfiFeeData;
}

export type TransfiOrderPhase = 'pending_payment' | 'processing' | 'completed' | 'failed';

export interface TransfiOrderStatusResponse {
  /** On-chain hash of the USDC delivery, once the asset has settled. */
  txnHash?: string;
  orderId: string;
  status: string;
  phase: TransfiOrderPhase;
  usdcAmount: string;
  fiatCurrency: string;
  feeData?: TransfiFeeData;
}

export interface VaultDepositConfig {
  methods: DepositMethod[];
  supportedChains: number[];
  supportedTokens: string[];
}

export interface Vault {
  name: string;
  type: VaultType;
  vaultToken: string;
  icon: AssetPath;
  decimals: number;
  vaults: {
    address: Address;
    chainId: number;
  }[];
  minimumAmount: string;
  depositConfig?: VaultDepositConfig;
  isComingSoon?: boolean;
  vaultName: string;
}

export enum VaultType {
  FUSE = 'fuse',
  USDC = 'usdc',
  ETH = 'eth',
}

export interface SavingsDataQuality {
  balanceSource: 'on-chain' | 'cached' | 'fallback';
  rateSource: 'on-chain' | 'cached' | 'fallback';
  depositedAccuracy: 'historical-rates' | 'current-rate-fallback' | 'explorer' | 'subgraph';
}

export interface SavingsSummaryResponse {
  vault: string;
  vaultToken: string;
  balanceShares: string;
  exchangeRate: string;
  totalValueUSD: string;
  actualDepositedUSD: string;
  interestEarnedUSD: string;
  apyPercent: number;
  lastDepositAt: string | null;
  activityCount: number;
  calculatedAt: string;
  dataQuality: SavingsDataQuality;
}

// ---------------------------------------------------------------------------
// Referral cashback program
// ---------------------------------------------------------------------------

export enum ReferralRewardStatus {
  PENDING = 'pending',
  QUALIFIED = 'qualified',
  PAID = 'paid',
  EXPIRED = 'expired',
  REVERSED = 'reversed',
  UNDER_REVIEW = 'under_review',
}

/**
 * Where an invited friend is in the journey. Unlike {@link ReferralRewardStatus}
 * (the ledger state, which only exists once the cashback engine has seeded a
 * record) this is always known, because the API derives it from the friend's
 * live account state.
 */
export enum ReferralFriendStage {
  REGISTERED = 'registered',
  VERIFYING = 'verifying',
  CARD_ORDERED = 'card_ordered',
  SPENDING = 'spending',
  REWARD_UNLOCKING = 'reward_unlocking',
  PAID = 'paid',
  EXPIRED = 'expired',
  UNDER_REVIEW = 'under_review',
  REVERSED = 'reversed',
}

export interface ReferralRewardListItem {
  referredUserId: string;
  username: string;
  stage: ReferralFriendStage;
  /** Null until the cashback engine has seeded a tracking record. */
  status: ReferralRewardStatus | null;
  signupAt: string;
  qualifiedAt?: string;
  /** When the dispute delay elapses. */
  payoutDueAt?: string;
  /**
   * When the payout actually lands — the first daily sweep at or after
   * `payoutDueAt`. Count down to this, never to `payoutDueAt`, or the timer
   * hits zero hours before the money moves.
   */
  payoutEtaAt?: string;
  paidAt?: string;
  spendUsd: number;
  merchantCount: number;
  hasActiveCard: boolean;
  rewardUsd: number;
  /** Explorer link for the referrer's payout, once that leg is on chain. */
  payoutTxUrl?: string;
}

export interface ReferralSummary {
  rewards: {
    referrerUsd: number;
    newUserUsd: number;
  };
  qualification: {
    spendTargetUsd: number;
    merchantTarget: number;
    windowDays: number;
    /** Days between qualifying and the payout — the dispute/chargeback cover. */
    payoutDelayDays: number;
  };
  totalRewardedUsd: number;
  friendsInvited: number;
  friendsQualified: number;
  friendsPending: number;
  hasActiveCard: boolean;
  referrals: ReferralRewardListItem[];
}

/**
 * Why the backend did — or did not — ask the app to show the native in-app
 * review sheet on this app open. Mirrors the accounts-service decision enum.
 */
export enum StoreReviewDecisionReason {
  ELIGIBLE = 'eligible',
  UNSUPPORTED_PLATFORM = 'unsupported_platform',
  NOT_ENOUGH_DEPOSITS = 'not_enough_deposits',
  NOT_ENOUGH_OPENS = 'not_enough_opens',
  COOLDOWN = 'cooldown',
  NO_NEW_DEPOSITS = 'no_new_deposits',
}

/** Response to recording an app open (`POST /accounts/v1/app-opens`). */
export interface AppOpenResponse {
  /** Opens recorded for this user on this platform, including the current one. */
  openCount: number;
  lastOpenedAt: string;
  /** Deposits the user has made to their card, per the backend. */
  cardDepositCount: number;
  /** True when the app should show the native review sheet now. */
  shouldRequestReview: boolean;
  reason: StoreReviewDecisionReason;
}

/** Response to confirming the review sheet was shown. */
export interface StoreReviewPromptedResponse {
  reviewPromptCount: number;
  lastReviewPromptedAt: string;
}
