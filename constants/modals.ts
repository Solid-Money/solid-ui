export const DEPOSIT_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_EMAIL_GATE: {
    name: 'open_email_gate',
    number: 1,
  },
  OPEN_OPTIONS: {
    name: 'open_options',
    number: 2,
  },
  OPEN_NETWORKS: {
    name: 'open_networks',
    number: 3,
  },
  OPEN_BUY_CRYPTO: {
    name: 'open_buy_crypto',
    number: 3,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 4,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 5,
  },
  OPEN_BANK_TRANSFER_AMOUNT: {
    name: 'open_bank_transfer_amount',
    number: 6,
  },
  OPEN_BANK_TRANSFER_PAYMENT: {
    name: 'open_bank_transfer_payment',
    number: 7,
  },
  OPEN_BANK_TRANSFER_PREVIEW: {
    name: 'open_bank_transfer_preview',
    number: 8,
  },
  OPEN_BANK_TRANSFER_KYC_INFO: {
    name: 'open_bank_transfer_kyc_info',
    number: 9,
  },
  OPEN_BANK_TRANSFER_KYC_FRAME: {
    name: 'open_bank_transfer_kyc_frame',
    number: 10,
  },
  OPEN_EXTERNAL_WALLET_OPTIONS: {
    name: 'open_external_wallet_options',
    number: 11,
  },
  OPEN_BUY_CRYPTO_OPTIONS: {
    name: 'open_buy_crypto_options',
    number: 12,
  },
  OPEN_PUBLIC_ADDRESS: {
    name: 'open_public_address',
    number: 13,
  },
  OPEN_DEPOSIT_DIRECTLY: {
    name: 'open_deposit_directly',
    number: 14,
  },
  OPEN_DEPOSIT_DIRECTLY_ADDRESS: {
    name: 'open_deposit_directly_address',
    number: 15,
  },
  OPEN_TOKEN_SELECTOR: {
    name: 'open_token_selector',
    number: 16,
  },
  OPEN_DEPOSIT_DIRECTLY_TOKENS: {
    name: 'open_deposit_directly_tokens',
    number: 17,
  },
};

export const SEND_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_SEND_SEARCH: {
    name: 'open_send_search',
    number: 1,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 2,
  },
  OPEN_TOKEN_SELECTOR: {
    name: 'open_token_selector',
    number: 3,
  },
  OPEN_REVIEW: {
    name: 'open_review',
    number: 4,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 5,
  },
  OPEN_ADDRESS_BOOK: {
    name: 'open_address_book',
    number: 6,
  },
};

export const WITHDRAW_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 1,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 2,
  },
};

export const STAKE_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 1,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 2,
  },
};

export const DEPOSIT_FROM_SAFE_ACCOUNT_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 1,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 2,
  },
};

export const UNSTAKE_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_OPTIONS: {
    name: 'open_options',
    number: 1,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 2,
  },
  OPEN_NETWORKS: {
    name: 'open_networks',
    number: 3,
  },
  OPEN_FAST_WITHDRAW_FORM: {
    name: 'open_fast_withdraw_form',
    number: 4,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 5,
  },
  OPEN_TOKEN_SELECTOR: {
    name: 'open_token_selector',
    number: 6,
  },
};

export const SWAP_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_FORM: {
    name: 'open_form',
    number: 1,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 2,
  },
};

// Card deposit modal (two-step flow)
export const CARD_DEPOSIT_MODAL = {
  CLOSE: {
    name: 'close',
    number: 0,
  },
  OPEN_OPTIONS: {
    // Step 1: choose source
    name: 'open_options',
    number: 1,
  },
  OPEN_INTERNAL_FORM: {
    // Step 2A: Wallet/Savings
    name: 'open_internal_form',
    number: 2,
  },
  OPEN_EXTERNAL_FORM: {
    // Step 2B: External wallet connect + form
    name: 'open_external_form',
    number: 2,
  },
  OPEN_TRANSACTION_STATUS: {
    name: 'open_transaction_status',
    number: 3,
  },
};
