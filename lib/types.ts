import {
  DEPOSIT_FROM_SAFE_ACCOUNT_MODAL,
  DEPOSIT_MODAL,
  SEND_MODAL,
  STAKE_MODAL,
  SWAP_MODAL,
  UNSTAKE_MODAL,
  WITHDRAW_MODAL,
} from '@/constants/modals';
import { Address, Hex } from 'viem';

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
  selected: boolean;
  signWith: string;
  suborgId: string;
  userId: string;
  referralCode?: string;
  isDeposited?: boolean;
  tokens?: AuthTokens;
  email?: string;
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

export type KycLinkFromBridgeResponse = {
  id: string;
  full_name: string;
  email: string;
  type: string;
  kyc_link: string;
  tos_link: string;
  kyc_status: string;
  rejection_reasons: string[];
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

export interface CustomerFromBridgeResponse {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  type: string;
  has_accepted_terms_of_service: boolean;
  rejection_reasons: string[];
  requirements_due: string[];
  future_requirements_due: string[];
  endorsements: BridgeCustomerEndorsement[];
}

export type BridgeCustomerEndorsement = {
  name: string;
  status: string;
  additional_requirements?: string[];
};

export enum KycStatus {
  NOT_STARTED = 'not_started',
  INCOMPLETE = 'incomplete',
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

interface Freeze {
  initiator: FreezeInitiator;
  card_account_id: string;
  reason: FreezeReason;
  reason_detail?: string;
  starting_at?: string;
  ending_at?: string;
  created_at: string;
}

export interface CardResponse {
  id: string;
  client_reference_id: string;
  customer_id: string;
  card_image_url: string;
  status: CardStatus;
  status_reason: string;
  card_details: CardDetails;
  balances: Balances;
  freezes: Freeze[];
  crypto_account: CryptoAccount;
  funding_instructions: FundingInstructions;
}

export interface CardStatusResponse {
  status: CardStatus;
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
  }[];
};

export enum TransactionType {
  DEPOSIT = 'deposit',
  UNSTAKE = 'unstake',
  WITHDRAW = 'withdraw',
  SEND = 'send',
  BRIDGE = 'bridge',
  BANK_TRANSFER = 'bank_transfer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export type Transaction = {
  title: string;
  timestamp: string;
  amount: number;
  status: TransactionStatus;
  hash?: string;
  type: TransactionType;
  symbol?: string;
  sourceDepositInstructions?: SourceDepositInstructions;
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
}

export type BridgeDeposit = {
  eoaAddress: Address;
  srcChainId: number;
  amount: string;
  permitSignature: {
    v: number;
    r: string;
    s: string;
    deadline: number;
  };
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
  permitSignature: {
    v: number;
    r: string;
    s: string;
    deadline: number;
  };
};

export enum BridgeTransactionStatus {
  PENDING = 'pending',
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
  eoaAddress: string;
  srcChainId: number;
  dstChainId: number;
  fromAmount: string;
  toAmount: string;
  decimals: number;
  permitTxHash?: string;
  transferTxHash?: string;
  approvalTxHash?: string;
  bridgeTxHash?: string;
  depositTxHash?: string;
  status: BridgeTransactionStatus;
  createdAt: Date;
}

export enum ActivityTab {
  ALL = 'all',
  PROGRESS = 'progress',
}

export interface SourceDepositInstructions {
  payment_rail: string;
  currency: string;
  amount: string;
  deposit_message: string;
  bank_account_number: string;
  bank_routing_number: string;
  bank_beneficiary_name: string;
  bank_beneficiary_address: string;
  bank_name: string;
  bank_address: string;
}

export interface BridgeTransferResponse {
  source_deposit_instructions: SourceDepositInstructions;
}

export interface TokenBalance {
  contractTickerSymbol: string;
  contractName: string;
  contractAddress: string;
  balance: string;
  quoteRate?: number;
  logoUrl?: string;
  contractDecimals: number;
  type: string;
  verified?: boolean;
  chainId: number;
}

export enum RewardsType {
  DEPOSIT = 'deposit',
  REFERRAL_SIGNUP = 'referral_signup',
  DAILY_LOGIN = 'daily_login',
}

export enum FromCurrency {
  BTC = 'btc',
  ETH = 'eth',
  EUR = 'eur',
  SOL = 'sol',
  USD = 'usd',
}

export enum ToCurrency {
  BRL = 'brl',
  BTC = 'btc',
  ETH = 'eth',
  EUR = 'eur',
  SOL = 'sol',
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
  };
}

export interface GetLifiQuoteParams {
  fromAddress: string;
  fromChain: number;
  fromToken?: string;
  fromAmount: bigint;
  toAddress: string;
  toChain?: number;
  toToken?: string;
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

export interface SignupUser {
  username: string;
  inviteCode?: string;
}

export enum PromiseStatus {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}
