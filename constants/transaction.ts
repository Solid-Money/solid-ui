import { TransactionCategory, TransactionDirection, TransactionType } from '@/lib/types';

type TransactionDetails = {
  sign: TransactionDirection;
  category: TransactionCategory;
};

export const TRANSACTION_DETAILS: Record<TransactionType, TransactionDetails> = {
  [TransactionType.DEPOSIT]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.UNSTAKE]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.WITHDRAW]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.SEND]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.WALLET_TRANSFER,
  },
  [TransactionType.RECEIVE]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.RECEIVE,
  },
  [TransactionType.BRIDGE]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.EXTERNAL_WALLET_TRANSFER,
  },
  [TransactionType.CANCEL_WITHDRAW]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.BRIDGE_DEPOSIT]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.EXTERNAL_WALLET_TRANSFER,
  },
  [TransactionType.BRIDGE_TRANSFER]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.BANK_DEPOSIT,
  },
  [TransactionType.BANK_TRANSFER]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.BANK_DEPOSIT,
  },
  [TransactionType.WIREX_BANK_DEPOSIT]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.BANK_DEPOSIT,
  },
  [TransactionType.WIREX_BANK_PAYOUT]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.BANK_WITHDRAWAL,
  },
  [TransactionType.CARD_TRANSACTION]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.CARD_DEPOSIT,
  },
  [TransactionType.CARD_WITHDRAWAL]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.CARD_WITHDRAWAL,
  },
  [TransactionType.MERCURYO_TRANSACTION]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.BANK_DEPOSIT,
  },
  [TransactionType.SWAP]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.SWAP,
  },
  [TransactionType.WRAP]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.SWAP,
  },
  [TransactionType.UNWRAP]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.SWAP,
  },
  [TransactionType.MERKL_CLAIM]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.REWARD,
  },
  [TransactionType.CARD_WELCOME_BONUS]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.REWARD,
  },
  [TransactionType.DEPOSIT_BONUS]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.REWARD,
  },
  [TransactionType.FUND]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.WALLET_TRANSFER,
  },
  [TransactionType.FAST_WITHDRAW]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.BORROW_AND_DEPOSIT_TO_CARD]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.CARD_DEPOSIT,
  },
  [TransactionType.CARD_DEPOSIT]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.CARD_DEPOSIT,
  },
  [TransactionType.REPAY_AND_WITHDRAW_COLLATERAL]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.WITHDRAW_COLLATERAL]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
  [TransactionType.RESCUE_TOKEN]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.WALLET_TRANSFER,
  },
  [TransactionType.AGENT_X402_PAYMENT]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.WALLET_TRANSFER,
  },
  [TransactionType.AGENT_WALLET_DEPOSIT]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.WALLET_TRANSFER,
  },
  [TransactionType.GOODDOLLAR_CLAIM]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.GOODDOLLAR_UBI,
  },
  [TransactionType.GOODDOLLAR_SWEEP]: {
    sign: TransactionDirection.IN,
    category: TransactionCategory.GOODDOLLAR_UBI,
  },
};

/**
 * Every card-destined movement is titled with "Card" — "Card deposit" for a
 * direct deposit the webhook routed to the card, "Deposit soUSD to Card" for
 * the bridge flows. No savings title mentions a card, and it is the only marker
 * activities created before `metadata.destinationType` existed carry, so the
 * category resolver and the savings filter both key off it.
 */
const hasCardTitle = (title?: string): boolean => !!title?.toLowerCase().includes('card');

/**
 * Resolve the user-facing transaction category.
 *
 * BRIDGE_DEPOSIT is dual-use: the same type backs both real cross-chain
 * bridges (→ "External wallet transfer") and "Deposit … to Card" deposits
 * where soUSD/USDC is bridged from Fuse to the card funding address. The
 * static map can't tell them apart, so a savings→card deposit was showing as
 * "External wallet transfer". Relabel the card variant (title contains
 * "Card", matching the backend's title convention for card deposits) as
 * "Card deposit".
 */
export const getTransactionCategory = (
  type: TransactionType,
  title?: string,
): TransactionCategory | undefined => {
  if (type === TransactionType.BRIDGE_DEPOSIT && hasCardTitle(title)) {
    return TransactionCategory.CARD_DEPOSIT;
  }
  return TRANSACTION_DETAILS[type]?.category;
};

/**
 * Types that move money into or out of the savings vault. Everything else —
 * card spend and funding, wallet sends/receives, swaps, bank transfers,
 * rewards, agent wallet and GoodDollar UBI — belongs to another surface.
 *
 * `DEPOSIT` and `BRIDGE_DEPOSIT` are on this list but are not savings on their
 * own: both also back card funding, so they need the card checks below.
 * The Rain collateral types (`WITHDRAW_COLLATERAL`,
 * `REPAY_AND_WITHDRAW_COLLATERAL`) are deliberately absent — they settle card
 * debt against Rain, not the vault, even though they are labelled
 * "Savings account".
 */
const SAVINGS_VAULT_TYPES: ReadonlySet<TransactionType> = new Set([
  TransactionType.DEPOSIT,
  TransactionType.BRIDGE_DEPOSIT,
  TransactionType.WITHDRAW,
  TransactionType.UNSTAKE,
  TransactionType.CANCEL_WITHDRAW,
  TransactionType.FAST_WITHDRAW,
]);

/** `DepositDestinationType.RAIN_CARD` — a direct deposit delivered to the card. */
const CARD_DESTINATION_TYPE = 'RAIN_CARD';

/**
 * Whether an activity is a deposit into, or a withdrawal out of, the savings
 * vault — the only history that belongs on the savings screen.
 *
 * Deliberately keyed on the type rather than on the category: card deposits are
 * recorded as `DEPOSIT` (direct deposits routed to the card) or `BRIDGE_DEPOSIT`
 * ("Deposit soUSD to Card"), so they resolve to the "Savings account" category
 * and read as savings. They are told apart by the destination the webhook
 * recorded, falling back to the card title convention for older rows.
 *
 * Nor is the symbol enough on its own: card deposits and plain wallet sends are
 * denominated in soUSD too, so a vault-token symbol does not make an activity
 * savings.
 */
export const isSavingsVaultActivity = (activity: {
  type: TransactionType;
  title?: string;
  metadata?: Record<string, any>;
}): boolean => {
  if (!SAVINGS_VAULT_TYPES.has(activity.type)) return false;
  if (activity.metadata?.destinationType === CARD_DESTINATION_TYPE) return false;
  return !hasCardTitle(activity.title);
};

/**
 * Card-deposit activity types that bridge from Fuse to the destination (card
 * funding / Rain collateral) via Stargate/LayerZero. Their SOURCE-chain receipt
 * confirms within seconds, but the funds take minutes to arrive — so a
 * source-chain receipt success must NOT mark them complete. The backend
 * finalizes them to SUCCESS from the Rain collateral webhook (destination
 * confirmation). Used to exclude them from client-side receipt polling, which
 * otherwise flipped every card deposit to SUCCESS instantly.
 */
export const SOURCE_RECEIPT_NON_FINAL_TYPES: ReadonlySet<TransactionType> = new Set([
  TransactionType.BRIDGE_DEPOSIT,
  TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
  TransactionType.CARD_DEPOSIT,
]);

/**
 * Whether an activity reaching a successful source-chain receipt can be treated
 * as complete. False for cross-chain card deposits (see above).
 */
export const isSourceReceiptFinalizable = (type: TransactionType): boolean =>
  !SOURCE_RECEIPT_NON_FINAL_TYPES.has(type);

/**
 * Metadata flag stamped by the deposit hooks when a `DEPOSIT` activity is
 * actually routed through a bridge (source chain !== Ethereum/Base target).
 * These are created as `TransactionType.DEPOSIT`, not `BRIDGE_DEPOSIT`, so the
 * type alone can't tell them apart from a same-chain deposit.
 */
export const CROSS_CHAIN_DEPOSIT_METADATA_KEY = 'isCrossChainDeposit';

/**
 * Whether a successful source-chain receipt means this specific activity is
 * done. Prefer this over `isSourceReceiptFinalizable`: it also rejects deposits
 * whose funds still have to cross a bridge before landing.
 *
 * A cross-chain deposit's source tx (approve / pull-from-user) mines in seconds
 * while the bridge fill + vault deposit take minutes, so finalizing on that
 * receipt showed "USDC added to your balance" / "Completed" while the backend
 * BridgeTransaction was still at `bridge_initiated`. Those deposits are
 * finalized by the backend once the bridge and vault deposit both complete.
 */
export const canFinalizeFromSourceReceipt = (activity: {
  type: TransactionType;
  metadata?: Record<string, any>;
}): boolean =>
  isSourceReceiptFinalizable(activity.type) &&
  activity.metadata?.[CROSS_CHAIN_DEPOSIT_METADATA_KEY] !== true;
