import { TransactionCategory, TransactionDirection, TransactionType } from '@/lib/types';

type TransactionDetails = {
  sign: TransactionDirection;
  category: TransactionCategory;
};

export const TRANSACTION_DETAILS: Record<TransactionType, TransactionDetails> = {
  [TransactionType.DEPOSIT]: {
    sign: TransactionDirection.IN,
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
  [TransactionType.FAST_WITHDRAW]: {
    sign: TransactionDirection.OUT,
    category: TransactionCategory.SAVINGS_ACCOUNT,
  },
};
