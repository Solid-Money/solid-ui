/** Why every key on the account is stopped at once. */
export type AiApiPauseReason = 'wallet_empty' | 'billing_mandate' | 'admin';

/** What a key reads as on the dashboard. */
export type AiApiKeyStatus = 'active' | 'limit_reached' | 'paused' | 'disabled';

export interface AiApiKey {
  id: string;
  name: string;
  /** The last four characters, to tell keys apart. The key itself is never sent again. */
  last4: string;
  monthlyLimitUsd: number;
  spentThisMonthUsd: number;
  cashbackThisMonthUsd: number;
  requestsThisMonth: number;
  status: AiApiKeyStatus;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AiApiMandate {
  moduleEnabled: boolean;
  registered: boolean;
  paused: boolean;
  cancelled: boolean;
  maxPerPeriodUsd: number;
  periodSeconds: number;
}

export interface AiApiBilling {
  /** Whether usage can be charged at all in this environment. */
  configured: boolean;
  chainId: number;
  moduleAddress: string | null;
  /** The period the mandate is signed with, in seconds. */
  periodSeconds: number;
  mandate: AiApiMandate | null;
  /** What the mandate must allow per period for the keys the user has now. */
  requiredMandateUsd: number;
  /** True when the user must sign (again) before charges can work. */
  needsMandate: boolean;
  /**
   * What the Wallet holds of the billing tokens on Base, in USD — USDC at par,
   * soUSD at its share price. The most one charge could take right now.
   */
  walletBalanceUsd: number | null;
  /** The tokens a charge is drawn from, in order: `["USDC"]`, later `["USDC", "soUSD"]`. */
  billingTokens: string[];
  /** Usage collected but not charged yet. */
  openChargeUsd: number;
  /**
   * The Wallet can't pay for what is used and not yet paid: requests are
   * refused until funds arrive, without the account being paused.
   */
  walletShort: boolean;
}

export interface AiApiOverview {
  available: boolean;
  /** The user's tier's AI cashback: 0.5 is 50%. */
  cashbackRate: number;
  /** Their tier's monthly AI cashback cap, USD. 0 means no cap. */
  cashbackMonthlyCapUsd: number;
  /** The tier those terms are for: Core, Prime or Ultra. */
  cashbackTier: string;
  /** Days each charge's cashback is held before it lands in USD Yield. */
  cashbackSettlementDays: number;
  /** Base URL without `/v1`; null means "use the API host". */
  baseUrl: string | null;
  limitOptionsUsd: number[];
  maxMonthlyLimitUsd: number;
  maxKeys: number;
  models: { id: string; name: string }[];
  defaultModel: string | null;
  month: {
    key: string;
    spentUsd: number;
    cashbackUsd: number;
    requests: number;
    resetsAt: string;
  };
  /** One entry per day of the month so far, today last. */
  daily: { day: string; spentUsd: number }[];
  keys: AiApiKey[];
  topModels: {
    model: string;
    name: string;
    tokens: number;
    requests: number;
    spentUsd: number;
  }[];
  account: {
    paused: boolean;
    pausedReason: AiApiPauseReason | null;
    pausedAt: string | null;
  };
  billing: AiApiBilling;
  cashback: { pendingUsd: number; paidUsd: number };
}

export interface CreateAiApiKeyResponse {
  key: AiApiKey;
  /** The full key. Shown once; never stored or sent again. */
  secret: string;
}

/** The 409 body when the Wallet mandate has to be signed (again) first. */
export interface AiApiMandateRequired {
  code: 'mandate_required';
  requiredMandateUsd: number;
  periodSeconds: number;
  /** The chain the mandate is signed on: Base. */
  chainId: number;
  moduleAddress: string | null;
  moduleEnabled: boolean;
  message: string;
}

/** What a daily AI API charge carries in its activity metadata. */
/** The metadata of the AI API's Activity row: one UTC day of usage. */
export interface AiApiChargeMetadata {
  /** The UTC day the row covers, `YYYY-MM-DD`. */
  day?: string;
  /** How many charges the day's usage was taken in. */
  chargeCount?: number;
  charges?: {
    chargeId: string;
    amountUsd: string;
    chargedAt: string | null;
    transactionHash: string | null;
  }[];
  fromDay?: string;
  toDay?: string;
  requests?: number;
  keys?: { name: string; amountUsd: string; requests: number }[];
  cashbackRate?: number | null;
  cashbackUsd?: string | null;
  cashbackStatus?: 'none' | 'pending' | 'paid' | 'failed';
  cashbackPayoutAt?: string | null;
  cashbackPaidAt?: string | null;
  cashbackTxHash?: string | null;
}
