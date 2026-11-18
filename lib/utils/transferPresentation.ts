import { formatDecimalAmount } from '@/lib/support/formatAmount';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';

/**
 * Saying what a wallet send or receive actually was.
 *
 * The indexers see a token move and nothing else, so on their own they title every transfer
 * "Send USDC.e" or "Receive EURC" — the token and a direction, and not a word about why. A
 * cardholder who cannot place a row like that reads it as money leaving, or arriving, for a reason
 * they do not know, and asks support whether it is fraud.
 *
 * Two layers fix that:
 *
 * - The backend names the transfers that are really money Solid paid — a card refund, cashback, a
 *   deposit arriving — and records what it found on `metadata.transferContext` (see
 *   `TransferContextService` in solid-backend). Those rows already carry their own title.
 * - Every other transfer is named here by who was on the other side: a saved contact when there is
 *   one, otherwise the short address. "Sent to Alice" says more than "Send USDC" ever did, and it
 *   reaches every row already written, which a backend rename could not.
 */

/**
 * Mirrors `TransferContextKind` in solid-backend
 * (`activity/interfaces/transfer-context.interface.ts`). An unknown kind is ignored rather than
 * trusted, so a newer backend cannot make an older build hide a row.
 */
export enum TransferContextKind {
  CARD_REFUND = 'card_refund',
  CARD_CREDIT = 'card_credit',
  CARD_CASHBACK = 'card_cashback',
  DEPOSIT_DELIVERY = 'deposit_delivery',
}

export type TransferContext = {
  kind: TransferContextKind;
  /** One sentence saying what the transfer is. */
  summary?: string;
  merchantName?: string;
  creditReason?: string;
  cardTransactionId?: string;
  /** The activity that already shows this money, for a deposit delivery. */
  linkedClientTxId?: string;
};

type TransferActivity = Pick<
  ActivityEvent,
  'type' | 'title' | 'status' | 'amount' | 'symbol' | 'fromAddress' | 'toAddress' | 'metadata'
>;

/** Saved contacts by lowercased address. */
export type ContactNames = ReadonlyMap<string, string>;

const KNOWN_KINDS = new Set<string>(Object.values(TransferContextKind));

const textOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

/**
 * What the backend found this transfer to be, or undefined when it found nothing.
 *
 * Rebuilt field by field rather than cast: `metadata` is free-form, and the summary and names
 * end up as text children, where anything but a string throws during render.
 */
export const getTransferContext = (
  activity: Pick<ActivityEvent, 'metadata'>,
): TransferContext | undefined => {
  const context: unknown = activity.metadata?.transferContext;
  if (!context || typeof context !== 'object') return undefined;

  const raw = context as Record<string, unknown>;
  if (typeof raw.kind !== 'string' || !KNOWN_KINDS.has(raw.kind)) return undefined;

  return {
    kind: raw.kind as TransferContextKind,
    summary: textOrUndefined(raw.summary),
    merchantName: textOrUndefined(raw.merchantName),
    creditReason: textOrUndefined(raw.creditReason),
    cardTransactionId: textOrUndefined(raw.cardTransactionId),
    linkedClientTxId: textOrUndefined(raw.linkedClientTxId),
  };
};

/** The row category for a transfer the backend named — "Card refund" rather than "Receive". */
const CONTEXT_CATEGORY: Record<TransferContextKind, string> = {
  [TransferContextKind.CARD_REFUND]: 'Card refund',
  [TransferContextKind.CARD_CREDIT]: 'Card credit',
  [TransferContextKind.CARD_CASHBACK]: 'Cashback',
  [TransferContextKind.DEPOSIT_DELIVERY]: 'Deposit',
};

export const getTransferCategory = (
  activity: Pick<ActivityEvent, 'metadata'>,
): string | undefined => {
  const context = getTransferContext(activity);
  return context ? CONTEXT_CATEGORY[context.kind] : undefined;
};

const isTransfer = (type: TransactionType): boolean =>
  type === TransactionType.SEND || type === TransactionType.RECEIVE;

/**
 * The titles a transfer gets when nobody chose one: the indexers' "Send USDC.e" and
 * "Receive EURC", and the app's own "Send 10 USDC". A title that is anything else was written on
 * purpose — "Deposit USDC to Card", a backend label — and is left alone.
 */
const BARE_TRANSFER_TITLE = /^(send|receive)(\s+[\d.,]+)?\s+\S+$/i;

/** Who was on the other side, or undefined when the row does not say. */
const counterpartyOf = (activity: TransferActivity): string | undefined =>
  (activity.type === TransactionType.SEND ? activity.toAddress : activity.fromAddress)?.trim() ||
  undefined;

/**
 * `0x54c1...08fe`, the same shortening `eclipseAddress` gives the detail rows.
 *
 * Spelled out rather than imported: `lib/utils/utils` pulls in native storage and the API client,
 * and this module is read by the feed's plain helpers (`unifiedActivity`), which must stay
 * importable on their own.
 */
const shortAddress = (address: string): string => `${address.slice(0, 6)}...${address.slice(-4)}`;

const counterpartyLabel = (address: string, contacts?: ContactNames): string =>
  contacts?.get(address.toLowerCase()) || shortAddress(address);

const isUnfinished = (status: TransactionStatus): boolean =>
  status === TransactionStatus.PENDING ||
  status === TransactionStatus.DETECTED ||
  status === TransactionStatus.PROCESSING;

const didNotHappen = (status: TransactionStatus): boolean =>
  status === TransactionStatus.FAILED ||
  status === TransactionStatus.CANCELLED ||
  status === TransactionStatus.EXPIRED;

/**
 * The title a send or receive row shows.
 *
 * "Sent to Alice" / "Received from 0x54c1...08fe" for a plain transfer, the backend's own name
 * ("Refund from UBER") for one it recognised, and the stored title for everything else.
 */
export const getTransferTitle = (activity: TransferActivity, contacts?: ContactNames): string => {
  const title = activity.title ?? '';
  if (!isTransfer(activity.type)) return title;
  if (getTransferContext(activity) && title.trim()) return title;
  // A missing title is as bare as "Send USDC" — name it by the counterparty too.
  if (title.trim() && !BARE_TRANSFER_TITLE.test(title.trim())) return title;

  const counterparty = counterpartyOf(activity);
  if (!counterparty) return title;

  const who = counterpartyLabel(counterparty, contacts);
  if (activity.type === TransactionType.RECEIVE) return `Received from ${who}`;
  if (isUnfinished(activity.status)) return `Sending to ${who}`;
  if (didNotHappen(activity.status)) return `Send to ${who}`;
  return `Sent to ${who}`;
};

const displaySymbol = (symbol?: string): string => {
  const trimmed = symbol?.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'usdc.e') return 'USDC.e';
  if (trimmed.toLowerCase() === 'sousd') return 'soUSD';
  return trimmed;
};

/**
 * One sentence saying what the transfer was, for the detail screen.
 *
 * The backend's summary when it named the transfer ("UBER refunded a card payment. It was paid
 * back into your wallet in USDC.e."), otherwise who sent what to whom. Undefined for anything that
 * is not a send or a receive.
 */
export const getTransferSummary = (
  activity: TransferActivity,
  contacts?: ContactNames,
): string | undefined => {
  const context = getTransferContext(activity);
  if (context?.summary) return context.summary;
  if (!isTransfer(activity.type)) return undefined;

  const counterparty = counterpartyOf(activity);
  if (!counterparty) return undefined;

  const who = counterpartyLabel(counterparty, contacts);
  const amount = Number(activity.amount);
  const value = [
    // From the decimal string, not the float, so the digits match the detail screen's support
    // card exactly.
    Number.isFinite(amount) && amount > 0 ? formatDecimalAmount(activity.amount) : '',
    displaySymbol(activity.symbol),
  ]
    .filter(Boolean)
    .join(' ');
  const what = value || 'funds';

  if (activity.type === TransactionType.RECEIVE) {
    return `${who} sent ${what} to your wallet.`;
  }
  if (isUnfinished(activity.status)) return `You are sending ${what} from your wallet to ${who}.`;
  if (didNotHappen(activity.status)) return `Your send of ${what} to ${who} did not go through.`;
  return `You sent ${what} from your wallet to ${who}.`;
};

/**
 * Whether this row is the delivery of a direct deposit that already has a row of its own.
 *
 * The deposit row is the one the user follows from detection to completion; the delivery is the
 * same money arriving in the Safe, and listing both reads as two deposits. The backend labels a
 * delivery only while the deposit's own row is visible, so leaving it out never hides the money.
 */
export const isDepositDeliveryActivity = (activity: Pick<ActivityEvent, 'metadata'>): boolean =>
  getTransferContext(activity)?.kind === TransferContextKind.DEPOSIT_DELIVERY;
