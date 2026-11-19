import { DEPOSIT_MODAL } from '@/constants/modals';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';

import type { DepositModal } from '@/lib/types';
import type {
  WalletTopUpAvailability,
  WalletTopUpCurrency,
  WalletTopUpErrorBody,
  WalletTopUpLimit,
  WalletTopUpMethod,
  WalletTopUpPlatform,
  WalletTopUpStatus,
  WalletTopUpToken,
} from '@/lib/types/wallet-topup';
import type { DepositProgressRow, DepositProgressState } from '@/lib/utils/deposit-steps';

/**
 * The Apple Pay / Google Pay wallet top-up, minus anything that renders: which
 * entry to offer, what an amount may be, how the status reads, and where back
 * goes. A leaf module (no assets, no SDKs) so all of it is unit tested.
 */

export const WALLET_TOPUP_METHOD_LABEL: Record<WalletTopUpMethod, string> = {
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

/** Where the user keeps the card they pay with. */
export const WALLET_TOPUP_WALLET_APP: Record<WalletTopUpMethod, string> = {
  apple_pay: 'Apple Wallet',
  google_pay: 'Google Wallet',
};

export const getWalletTopUpPlatform = (os: string): WalletTopUpPlatform =>
  os === 'ios' || os === 'android' ? os : 'web';

/**
 * What this device can pay with, as the Wirex SDK of its platform answers it.
 * Native only ever sets the first two.
 */
export interface WalletDeviceAvailability {
  applePay: boolean;
  googlePay: boolean;
  /** Web: Google Pay cannot pay here, but the checkout's QR hands it to an Android phone. */
  googlePayHandoff: boolean;
  /** Web on Android: Google Pay works, but no card in Google Wallet on this phone qualifies. */
  googlePayNeedsCard: boolean;
}

export interface WalletTopUpEntry {
  visible: boolean;
  method: WalletTopUpMethod;
  /** Shown, but the user has to add a card to Google Wallet before they can pay. */
  needsCard: boolean;
}

export const HIDDEN_WALLET_TOPUP_ENTRY: WalletTopUpEntry = {
  visible: false,
  method: 'apple_pay',
  needsCard: false,
};

/**
 * Whether to offer the top-up row, and with which wallet.
 *
 * Fails closed: hidden unless the backend said available AND the device answered.
 * The apps offer their own platform's wallet only. The web offers Apple Pay where
 * Safari can pay, else Google Pay where Chrome can — natively on Android, or
 * through the checkout's QR on desktop. An Android browser whose Google Wallet has
 * no usable card keeps the row, flagged, so it can say to add one first.
 */
export const resolveWalletTopUpEntry = (
  platform: WalletTopUpPlatform,
  isAvailable: boolean,
  device: WalletDeviceAvailability | null | undefined,
): WalletTopUpEntry => {
  if (!isAvailable || !device) return HIDDEN_WALLET_TOPUP_ENTRY;

  const offer = (method: WalletTopUpMethod, needsCard = false): WalletTopUpEntry => ({
    visible: true,
    method,
    needsCard,
  });

  if (platform === 'ios') return device.applePay ? offer('apple_pay') : HIDDEN_WALLET_TOPUP_ENTRY;
  if (platform === 'android') {
    return device.googlePay ? offer('google_pay') : HIDDEN_WALLET_TOPUP_ENTRY;
  }
  if (device.applePay) return offer('apple_pay');
  if (device.googlePay || device.googlePayHandoff) return offer('google_pay');
  if (device.googlePayNeedsCard) return offer('google_pay', true);
  return HIDDEN_WALLET_TOPUP_ENTRY;
};

/** The entry row's words, on both the "Deposit with" chooser and the card's funding options. */
export const getWalletTopUpRowCopy = (
  method: WalletTopUpMethod,
  needsCard: boolean,
): { title: string; subtitle: string } => ({
  title: WALLET_TOPUP_METHOD_LABEL[method],
  subtitle: needsCard
    ? `Add a card to ${WALLET_TOPUP_WALLET_APP[method]} to top up instantly`
    : `Top up instantly from a card in ${WALLET_TOPUP_WALLET_APP[method]}`,
});

/** The token a currency pays out, as the backend names it. */
export const getWalletTopUpToken = (
  availability: Pick<WalletTopUpAvailability, 'payoutTokens'> | null | undefined,
  currency: WalletTopUpCurrency,
): WalletTopUpToken =>
  availability?.payoutTokens?.[currency] ?? (currency === 'EUR' ? 'EURC' : 'USDC');

// -----------------------------------------------------------------------------
// Amount
// -----------------------------------------------------------------------------

/**
 * What the amount box keeps of a keystroke: digits and one decimal point, with
 * at most two decimals — the most the backend accepts.
 */
export const sanitizeWalletTopUpAmount = (text: string): string => {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (!rest.length) return whole;
  return `${whole}.${rest.join('').slice(0, 2)}`;
};

export type WalletTopUpAmountCheck = 'empty' | 'invalid' | 'below_min' | 'above_max' | 'ok';

/** Whether an amount may be quoted, against this currency's per-top-up limits. */
export const checkWalletTopUpAmount = (
  amount: string,
  limit: WalletTopUpLimit | undefined,
): WalletTopUpAmountCheck => {
  const trimmed = amount.trim();
  if (!trimmed) return 'empty';
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid';
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return 'invalid';
  if (limit) {
    if (value < Number(limit.min)) return 'below_min';
    if (value > Number(limit.max)) return 'above_max';
  }
  return 'ok';
};

/** The amount as the quote endpoint takes it: a two-decimal string. */
export const toWalletTopUpWireAmount = (amount: string): string => Number(amount).toFixed(2);

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

const formatDecimal = (value: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

/** `$10.00`, `€87.40`, or `12.00 CHF` for a currency with no symbol of ours. */
export const formatWalletTopUpMoney = (amount: string | number, currency: string): string => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  return symbol ? `${symbol}${formatDecimal(value)}` : `${formatDecimal(value)} ${currency}`;
};

/** `100.00 USDC`. */
export const formatWalletTopUpTokenAmount = (amount: string | number, token: string): string => {
  const value = Number(amount);
  return `${Number.isFinite(value) ? formatDecimal(value) : amount} ${token}`;
};

// -----------------------------------------------------------------------------
// Status
// -----------------------------------------------------------------------------

/** Statuses the app stops polling at. `review` is still open for ops, not for the user. */
const SETTLED_STATUSES: ReadonlySet<WalletTopUpStatus> = new Set([
  'completed',
  'failed',
  'expired',
  'review',
]);

export const isWalletTopUpSettled = (status: WalletTopUpStatus | undefined): boolean =>
  !!status && SETTLED_STATUSES.has(status);

/** How many of the three steps a status has finished. */
const STEPS_DONE: Record<WalletTopUpStatus, number> = {
  quoted: 0,
  pending: 1,
  confirmed: 2,
  completed: 3,
  review: 1,
  failed: 0,
  expired: 0,
};

/**
 * "Paid with Apple Pay" → "Confirmed by Wirex" → "Added to your wallet", as the
 * shared deposit stepper draws them. Before the first status read, the payment is
 * the step in progress.
 */
export const getWalletTopUpProgress = (
  status: WalletTopUpStatus | undefined,
  method: WalletTopUpMethod,
): DepositProgressRow[] => {
  const done = status ? STEPS_DONE[status] : 0;
  const isFailed = status === 'failed' || status === 'expired';
  const steps = [
    { key: 'received' as const, label: `Paid with ${WALLET_TOPUP_METHOD_LABEL[method]}` },
    { key: 'confirmed' as const, label: 'Confirmed by Wirex' },
    { key: 'depositing' as const, label: 'Added to your wallet' },
  ];
  return steps.map((step, index) => {
    const state: DepositProgressState =
      index < done ? 'complete' : index === done ? (isFailed ? 'failed' : 'active') : 'pending';
    return { ...step, state };
  });
};

// -----------------------------------------------------------------------------
// Checkout outcomes
// -----------------------------------------------------------------------------

/**
 * What to do when Wirex's checkout says its execute call failed.
 *
 * - `reconcile`: money may have moved (a second execute, no response, a 5xx) —
 *   read the top-up's status rather than offering the button again.
 * - `rearm`: the quote or its checkout token ran out — fetch a fresh one quietly.
 * - `retry`: refused outright — say so, then re-arm so the button works again.
 */
export type WalletExecuteFailureAction = 'reconcile' | 'rearm' | 'retry';

export const getWalletExecuteFailureAction = (reason: string): WalletExecuteFailureAction => {
  if (reason === 'already_executed' || reason === 'network_error' || reason === 'execute_failed') {
    return 'reconcile';
  }
  if (reason === 'estimation_expired' || reason === 'execute_unauthorized') return 'rearm';
  return 'retry';
};

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

/** A refused top-up request, with the body the backend explained it in. */
export class WalletTopUpRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'WalletTopUpRequestError';
    this.status = status;
    this.code = code;
  }
}

export const toWalletTopUpRequestError = async (
  response: Response,
): Promise<WalletTopUpRequestError> => {
  let body: WalletTopUpErrorBody | undefined;
  try {
    body = (await response.json()) as WalletTopUpErrorBody;
  } catch {
    body = undefined;
  }
  const message = typeof body?.message === 'string' ? body.message : '';
  const code = typeof body?.code === 'string' ? body.code : undefined;
  return new WalletTopUpRequestError(response.status, message, code);
};

/**
 * The sentence a failed quote shows under the amount.
 *
 * A 400 names the limit the amount broke and a 429 the daily limit, both in the
 * backend's words; everything else gets ours, since what went wrong upstream is
 * nothing the user can act on.
 */
export const getWalletTopUpQuoteErrorMessage = (
  error: unknown,
  method: WalletTopUpMethod,
): string => {
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof WalletTopUpRequestError ? error.message : '';
  if ((status === 400 || status === 429) && message) return message;
  if (status === 403) {
    return `${WALLET_TOPUP_METHOD_LABEL[method]} top-ups aren't available on your account right now.`;
  }
  if (status === 429) return "You've reached your top-up limit for now. Try again later.";
  return "We couldn't get a price right now. Try again.";
};

// -----------------------------------------------------------------------------
// Flow
// -----------------------------------------------------------------------------

const WALLET_TOPUP_MODAL_NAMES = new Set<string>([
  DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT.name,
  DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW.name,
  DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS.name,
]);

export const isWalletTopUpModal = (modal: DepositModal | null | undefined): boolean =>
  !!modal && WALLET_TOPUP_MODAL_NAMES.has(modal.name);

/** The status step carries its own headline, so it has no title. */
export const getWalletTopUpTitle = (
  modal: DepositModal,
  method: WalletTopUpMethod,
): string | undefined => {
  if (modal.name === DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT.name) {
    return WALLET_TOPUP_METHOD_LABEL[method];
  }
  if (modal.name === DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW.name) return 'Review';
  return undefined;
};

/**
 * Where back goes from a top-up step: `entry` is the screen the row was on (the
 * "Deposit with" chooser, or the card's funding options), and the status step
 * leaves the flow — the card may already be charged, so there is nothing to undo.
 */
export type WalletTopUpBackTarget = DepositModal | 'entry' | 'close';

export const getWalletTopUpBackTarget = (modal: DepositModal): WalletTopUpBackTarget => {
  if (modal.name === DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW.name) {
    return DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT;
  }
  if (modal.name === DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS.name) return 'close';
  return 'entry';
};

/** Back is offered on the amount and review steps only. */
export const canGoBackFromWalletTopUp = (modal: DepositModal): boolean =>
  modal.name !== DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS.name;
