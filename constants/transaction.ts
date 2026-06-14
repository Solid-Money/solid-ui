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
};

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
  if (type === TransactionType.BRIDGE_DEPOSIT && title?.toLowerCase().includes('card')) {
    return TransactionCategory.CARD_DEPOSIT;
  }
  return TRANSACTION_DETAILS[type]?.category;
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
