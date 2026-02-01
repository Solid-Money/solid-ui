import { EndorsementStatus } from '@/components/BankTransfer/enums';
import {
  DEPOSIT_FROM_SAFE_ACCOUNT_MODAL,
  DEPOSIT_MODAL,
  SEND_MODAL,
  STAKE_MODAL,
  SWAP_MODAL,
  UNSTAKE_MODAL,
  WITHDRAW_MODAL,
} from '@/constants/modals';
import { Reward } from '@merkl/api';
import { Address, Hex } from 'viem';
import { AssetPath } from './assets';

export interface CountryFromIp {
  countryCode: string;
  countryName: string;
}

export interface CountryInfo {
  countryCode: string;
  countryName: string;
  isAvailable: boolean;
  source?: 'ip' | 'manual';
}

export interface CardAccessResponse {
  hasAccess: boolean;
  countryCode: string;
}

export interface VerifyCountryRequest {
  visitorId: string;
  requestId: string;
  claimedCountry: string;
}

/**
 * Fraud signals from Fingerprint.com Smart Signals API.
 * These signals help detect various fraud vectors like VPNs, location spoofing,
 * device tampering (Frida), and other suspicious behaviors.
 */
export interface FraudSignals {
  isVpn: boolean;
  vpnMethods?: {
    timezoneMismatch?: boolean;
    publicVPN?: boolean;
    osMismatch?: boolean;
  };
  vpnOriginCountry?: string;
  isLocationSpoofed: boolean;
  isFridaDetected: boolean;
  suspectScore?: number;
  isJailbroken?: boolean;
  isRooted?: boolean;
  isProxy?: boolean;
  isHighActivity?: boolean;
  factoryResetTime?: string;
  isClonedApp?: boolean;
  isMitmAttack?: boolean;
}

export interface VerifyCountryResponse {
  verified: boolean;
  detectedCountry: string | null;
  confidence: number;
  requiresVerification: boolean;
  reason?: string;
  /** Detailed fraud signals from Fingerprint.com Smart Signals */
  fraudSignals?: FraudSignals;
  /** Specific reason why verification was blocked */
  blockingReason?:
    | 'vpn_country_mismatch'
    | 'location_spoofing'
    | 'automation_detected'
    | 'service_unavailable';
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

export interface CardDepositBonusConfig {
  isEnabled: boolean;
  percentage: number;
  cap: number;
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
  client_note?: string;
  type?: 'top_up_balance_withdrawal' | 'fee';
}

export interface WithdrawFromCardToSavingsResponse {
  withdrawalId: string;
  status: 'pending';
  amount: string;
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

enum FreezeInitiator {
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
  monthlyFuseAmount: number;
  monthlyUsdValue: number;
  totalFuseAmount: number;
  totalUsdValue: number;
  percentage: number;
}

export interface CardDetailsResponseDto extends CardResponse {
  cashback: CashbackData;
}

export interface CardStatusResponse {
  status?: CardStatus;
  activationBlocked?: boolean;
  activationBlockedReason?: string;
  activationFailedAt?: string;
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
  FAST_WITHDRAW = 'fast_withdraw',
  REPAY_AND_WITHDRAW_COLLATERAL = 'repay_and_withdraw_collateral',
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
  RECEIVE = 'Receive',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
}

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

export type TransactionStatusModal = {
  amount?: number;
  address?: Address;
  trackingId?: string;
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
};

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

export type BankTransferPaymentRail = 'ach_push' | 'wire' | 'sepa' | 'spei';

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
  fuseAmount?: string;
  fuseUsdPrice?: string;
  createdAt: string;
}

export interface CashbackInfo {
  amount: string;
  isPending: boolean;
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
  maxCashbackMonthly: number;
}

export interface TierBenefit {
  title: string;
  subtitle?: string;
  image?: string;
}

export interface TierBenefits {
  tier: RewardsTier;
  depositBoost: TierBenefit;
  cardCashback: TierBenefit;
  subscriptionDiscount: TierBenefit | null;
  cardCashbackCap: TierBenefit;
  subscriptionDiscountCap: TierBenefit | null;
  cardFees: TierBenefit;
  bankDeposit: TierBenefit;
  swapFees: TierBenefit;
  support: TierBenefit;
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
  serviceLimit: number;
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
  eligibleServices: string[];
  tier1: TierSubscriptionDiscountConfig;
  tier2: TierSubscriptionDiscountConfig;
  tier3: TierSubscriptionDiscountConfig;
}

export interface FuseStakingConfig {
  tier2Amount: number;
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
  cardSpendPointsPerDollar: number;
  swapPointsPerDollar: number;
  holdingFundsMultiplier: number;
}

export interface FullRewardsConfig {
  tiers: TierThresholds;
  points: PointsEarningConfig;
  cashback: CashbackConfig;
  subscriptionDiscount: SubscriptionDiscountConfig;
  fuseStaking: FuseStakingConfig;
  referral: ReferralConfig;
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

export interface CardTransaction {
  id: string;
  card_account_id: string;
  customer_id: string;
  category: 'adjustment' | 'purchase' | 'refund' | 'withdrawal' | 'crypto_funding';
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
  local_transaction_details?: LocalTransactionDetails;
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
  txHash?: string;
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

export interface WhatsNewStep {
  imageUrl: string;
  title: string;
  text: string;
}

export interface WhatsNew {
  _id: string;
  steps: WhatsNewStep[];
  isActive: boolean;
  showOnLoad: boolean;
  createdAt: string;
}

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

export type SSEEventData =
  | { type: 'ping'; data: SSEPingData }
  | { type: 'activity'; data: SSEActivityData };

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

export interface Vault {
  name: string;
  icon: AssetPath;
}
