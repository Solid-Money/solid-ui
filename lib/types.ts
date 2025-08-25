import {
  DEPOSIT_MODAL,
  SEND_MODAL,
  SWAP_MODAL,
  UNSTAKE_MODAL,
  WITHDRAW_MODAL,
} from '@/constants/modals';
import { Address } from 'viem';

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
  link: string;
  tosLink: string;
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
}

export type Transaction = {
  title: string;
  timestamp: string;
  amount: number;
  status: LayerZeroTransactionStatus;
  hash?: string;
  type: TransactionType;
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

export interface Points {
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
