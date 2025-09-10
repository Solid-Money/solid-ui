export const TRACKING_EVENTS = {
  // Transaction Flow Events - Deposit
  DEPOSIT_INITIATED: 'deposit_initiated',
  DEPOSIT_COMPLETED: 'deposit_completed',
  DEPOSIT_CANCELLED: 'deposit_cancelled',
  DEPOSIT_ERROR: 'deposit_error',
  DEPOSIT_FAILED: 'deposit_failed',
  DEPOSIT_VALIDATED: 'deposit_validated',
  DEPOSIT_PERMIT_REQUESTED: 'deposit_permit_requested',
  DEPOSIT_PERMIT_SIGNED: 'deposit_permit_signed',
  DEPOSIT_TRANSACTION_STARTED: 'deposit_transaction_started',
  DEPOSIT_BRIDGE_STARTED: 'deposit_bridge_started',

  // Transaction Flow Events - Send/Transfer
  SEND_TRANSACTION_INITIATED: 'send_transaction_initiated',
  SEND_TRANSACTION_COMPLETED: 'send_transaction_completed',
  SEND_TRANSACTION_ERROR: 'send_transaction_error',
  SEND_PAGE_TRANSACTION_INITIATED: 'send_page_transaction_initiated',
  SEND_PAGE_TRANSACTION_COMPLETED: 'send_page_transaction_completed',
  SEND_PAGE_TRANSACTION_FAILED: 'send_page_transaction_failed',

  // Transaction Flow Events - Withdraw
  WITHDRAW_TRANSACTION_INITIATED: 'withdraw_transaction_initiated',
  WITHDRAW_TRANSACTION_COMPLETED: 'withdraw_transaction_completed',
  WITHDRAW_TRANSACTION_ERROR: 'withdraw_transaction_error',

  // Transaction Flow Events - Swap
  SWAP_INITIATED: 'swap_initiated',
  SWAP_COMPLETED: 'swap_completed',
  SWAP_FAILED: 'swap_failed',
  PEG_SWAP_INITIATED: 'peg_swap_initiated',
  PEG_SWAP_COMPLETED: 'peg_swap_completed',
  PEG_SWAP_FAILED: 'peg_swap_failed',

  // Transaction Flow Events - Wrap
  WRAP_INITIATED: 'wrap_initiated',
  WRAP_COMPLETED: 'wrap_completed',
  WRAP_FAILED: 'wrap_failed',

  // Transaction Flow Events - Bridge
  BRIDGE_TO_MAINNET_INITIATED: 'bridge_to_mainnet_initiated',
  BRIDGE_TO_MAINNET_COMPLETED: 'bridge_to_mainnet_completed',
  BRIDGE_TO_MAINNET_CANCELLED: 'bridge_to_mainnet_cancelled',
  BRIDGE_TO_MAINNET_ERROR: 'bridge_to_mainnet_error',

  // Transaction Flow Events - Approval
  APPROVE_INITIATED: 'approve_initiated',
  APPROVE_COMPLETED: 'approve_completed',
  APPROVE_ERROR: 'approve_error',

  // Transaction Flow Events - Cancel Withdraw
  CANCEL_WITHDRAW_INITIATED: 'cancel_withdraw_initiated',
  CANCEL_WITHDRAW_COMPLETED: 'cancel_withdraw_completed',
  CANCEL_WITHDRAW_CANCELLED: 'cancel_withdraw_cancelled',
  CANCEL_WITHDRAW_ERROR: 'cancel_withdraw_error',

  // User Interface & Navigation Events
  NAVBAR_LOGO_CLICKED: 'navbar_logo_clicked',
  NAVIGATION_BUTTON_CLICKED: 'navigation_button_clicked',
  SWAP_PAGE_BACK_BUTTON_PRESSED: 'swap_page_back_button_pressed',

  // Modal Events
  SEND_MODAL_OPENED: 'send_modal_opened',
  SEND_MODAL_CLOSED: 'send_modal_closed',
  WITHDRAW_MODAL_OPENED: 'withdraw_modal_opened',
  WITHDRAW_MODAL_CLOSED: 'withdraw_modal_closed',
  STAKE_MODAL_OPENED: 'stake_modal_opened',
  STAKE_MODAL_CLOSED: 'stake_modal_closed',

  // Token Selection Events
  SEND_PAGE_TOKEN_SELECTOR_OPENED: 'send_page_token_selector_opened',
  SEND_PAGE_TOKEN_SELECTED: 'send_page_token_selected',

  // Transaction Status Events
  SEND_TRANSACTION_STATUS_PRESSED: 'send_transaction_status_pressed',
  WITHDRAW_TRANSACTION_STATUS_PRESSED: 'withdraw_transaction_status_pressed',
  STAKE_TRANSACTION_STATUS_PRESSED: 'stake_transaction_status_pressed',

  // Wallet & Connection Events
  WALLET_DROPDOWN_OPENED: 'wallet_dropdown_opened',
  WALLET_DISCONNECTED: 'wallet_disconnected',
  DEPOSIT_WALLET_ALREADY_CONNECTED: 'deposit_wallet_already_connected',
  DEPOSIT_WALLET_CONNECTION_STARTED: 'deposit_wallet_connection_started',
  DEPOSIT_WALLET_CONNECTION_SUCCESS: 'deposit_wallet_connection_success',
  DEPOSIT_WALLET_CONNECTION_FAILED: 'deposit_wallet_connection_failed',

  // Payment & Deposit Method Events
  PAYMENT_METHOD_SELECTED: 'payment_method_selected',
  DEPOSIT_METHOD_SELECTED: 'deposit_method_selected',
  DEPOSIT_OPTIONS_VIEWED: 'deposit_options_viewed',
  DEPOSIT_OPTIONS_ABANDONED: 'deposit_options_abandoned',
  NETWORK_SELECTED: 'network_selected',
  BANK_TRANSFER_CREATED: 'bank_transfer_created',

  // User Registration Events
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  SIGNUP_FAILED: 'signup_failed',
  LOGGED_IN: 'logged_in',
  LOGIN_FAILED: 'login_failed',
  LOGGED_OUT: 'logged_out',
  WELCOME_USER: 'welcome_user',
  FORGOT_ALL_USERS: 'forgot_all_users',
  DELETE_ACCOUNT: 'delete_account',
  
  // Email Events
  EMAIL_ENTRY_STARTED: 'email_entry_started',
  EMAIL_SUBMITTED: 'email_submitted',
  EMAIL_OTP_REQUESTED: 'email_otp_requested',
  EMAIL_OTP_VERIFIED: 'email_otp_verified',
  EMAIL_VERIFICATION_FAILED: 'email_verification_failed',
  EMAIL_SKIPPED: 'email_skipped',

  // Feature Discovery Events
  TOOLTIP_OPENED: 'tooltip_opened',
} as const;

export type TrackingEvent = typeof TRACKING_EVENTS[keyof typeof TRACKING_EVENTS];