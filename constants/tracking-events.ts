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
  SWAP_MODAL_VIEWED: 'swap_modal_viewed',
  SWAP_AMOUNT_ENTRY_STARTED: 'swap_amount_entry_started',
  SWAP_TOKEN_SELECTOR_OPENED: 'swap_token_selector_opened',
  SWAP_MODAL_ABANDONED: 'swap_modal_abandoned',
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

  // Transaction Flow Events - Bridge to Arbitrum
  BRIDGE_TO_ARBITRUM_INITIATED: 'bridge_to_arbitrum_initiated',
  BRIDGE_TO_ARBITRUM_COMPLETED: 'bridge_to_arbitrum_completed',
  BRIDGE_TO_ARBITRUM_CANCELLED: 'bridge_to_arbitrum_cancelled',
  BRIDGE_TO_ARBITRUM_ERROR: 'bridge_to_arbitrum_error',

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
  DEPOSIT_TRIGGER_CLICKED: 'deposit_trigger_clicked',
  DEPOSIT_AMOUNT_ENTRY_STARTED: 'deposit_amount_entry_started',
  DEPOSIT_VALIDATION_ERROR: 'deposit_validation_error',
  DEPOSIT_MAX_BUTTON_CLICKED: 'deposit_max_button_clicked',
  WALLET_CONNECT_MODAL_VIEWED: 'wallet_connect_modal_viewed',
  NETWORK_SELECTED: 'network_selected',
  BANK_TRANSFER_CREATED: 'bank_transfer_created',

  // Deposit Method: Crypto Wallet (Method 1)
  DEPOSIT_WALLET_NETWORK_VIEWED: 'deposit_wallet_network_viewed',
  DEPOSIT_WALLET_NETWORK_SELECTED: 'deposit_wallet_network_selected',
  DEPOSIT_WALLET_FORM_VIEWED: 'deposit_wallet_form_viewed',
  DEPOSIT_WALLET_FORM_SUBMITTED: 'deposit_wallet_form_submitted',
  DEPOSIT_WALLET_NETWORK_ABANDONED: 'deposit_wallet_network_abandoned',
  DEPOSIT_WALLET_FORM_ABANDONED: 'deposit_wallet_form_abandoned',

  // Deposit Method: Direct Deposit (Method 2)
  DEPOSIT_DIRECT_NETWORK_VIEWED: 'deposit_direct_network_viewed',
  DEPOSIT_DIRECT_NETWORK_SELECTED: 'deposit_direct_network_selected',
  DEPOSIT_DIRECT_TOKEN_VIEWED: 'deposit_direct_token_viewed',
  DEPOSIT_DIRECT_TOKEN_SELECTED: 'deposit_direct_token_selected',
  DEPOSIT_DIRECT_ADDRESS_VIEWED: 'deposit_direct_address_viewed',
  DEPOSIT_DIRECT_ADDRESS_COPIED: 'deposit_direct_address_copied',
  DEPOSIT_DIRECT_QR_VIEWED: 'deposit_direct_qr_viewed',
  DEPOSIT_DIRECT_ADDRESS_SHARED: 'deposit_direct_address_shared',
  DEPOSIT_DIRECT_SESSION_CREATED: 'deposit_direct_session_created',
  DEPOSIT_DIRECT_SESSION_CREATION_FAILED: 'deposit_direct_session_creation_failed',
  DEPOSIT_DIRECT_SESSION_DETECTED: 'deposit_direct_session_detected',
  DEPOSIT_DIRECT_SESSION_COMPLETED: 'deposit_direct_session_completed',
  DEPOSIT_DIRECT_SESSION_DELETED: 'deposit_direct_session_deleted',

  // Deposit Method: Credit Card (Method 3)
  DEPOSIT_CARD_WIDGET_LOADING: 'deposit_card_widget_loading',
  DEPOSIT_CARD_WIDGET_LOADED: 'deposit_card_widget_loaded',
  DEPOSIT_CARD_WIDGET_LOAD_FAILED: 'deposit_card_widget_load_failed',
  DEPOSIT_CARD_TRANSACTION_CREATED: 'deposit_card_transaction_created',
  DEPOSIT_CARD_TRANSACTION_CREATION_FAILED: 'deposit_card_transaction_creation_failed',

  // Deposit Method: Bank Deposit (Method 4)
  DEPOSIT_BANK_AMOUNT_VIEWED: 'deposit_bank_amount_viewed',
  DEPOSIT_BANK_AMOUNT_ENTERED: 'deposit_bank_amount_entered',
  DEPOSIT_BANK_PAYMENT_METHOD_VIEWED: 'deposit_bank_payment_method_viewed',
  DEPOSIT_BANK_KYC_VIEWED: 'deposit_bank_kyc_viewed',
  DEPOSIT_BANK_KYC_STARTED: 'deposit_bank_kyc_started',
  DEPOSIT_BANK_KYC_PARSED: 'deposit_bank_kyc_parsed',
  DEPOSIT_BANK_KYC_COMPLETED: 'deposit_bank_kyc_completed',
  DEPOSIT_BANK_KYC_CANCELLED: 'deposit_bank_kyc_cancelled',
  DEPOSIT_BANK_KYC_ERROR: 'deposit_bank_kyc_error',
  DEPOSIT_BANK_INSTRUCTIONS_VIEWED: 'deposit_bank_instructions_viewed',
  DEPOSIT_BANK_INSTRUCTIONS_COPIED: 'deposit_bank_instructions_copied',
  DEPOSIT_BANK_AMOUNT_ABANDONED: 'deposit_bank_amount_abandoned',
  DEPOSIT_BANK_INSTRUCTIONS_ABANDONED: 'deposit_bank_instructions_abandoned',

  // Deposit Bonus Banner Events
  DEPOSIT_BONUS_BANNER_VIEWED: 'deposit_bonus_banner_viewed',
  DEPOSIT_BONUS_BANNER_INFLUENCED: 'deposit_bonus_banner_influenced',

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

  // Passkey Events
  PASSKEY_ADDED: 'passkey_added',
  PASSKEY_SKIPPED: 'passkey_skipped',
  PASSKEY_CREATION_FAILED: 'passkey_creation_failed',

  // Quest Wallet Events
  QUEST_WALLET_PAGE_VIEWED: 'quest_wallet_page_viewed',
  QUEST_WALLET_ADDRESS_SUBMITTED: 'quest_wallet_address_submitted',
  QUEST_WALLET_ADDRESS_UPDATED: 'quest_wallet_address_updated',
  QUEST_WALLET_VALIDATION_ERROR: 'quest_wallet_validation_error',
  QUEST_WALLET_UPDATE_SUCCESS: 'quest_wallet_update_success',
  QUEST_WALLET_UPDATE_FAILED: 'quest_wallet_update_failed',

  // Feature Discovery Events
  TOOLTIP_OPENED: 'tooltip_opened',

  // Card Waitlist Events
  CARD_WAITLIST_STARTED: 'card_waitlist_started',
  CARD_WAITLIST_COMPLETED: 'card_waitlist_completed',

  // Card & KYC Events
  CARD_GET_CARD_PRESSED: 'get_card_pressed',
  CARD_COUNTRY_SELECTED: 'card_country_selected',
  CARD_COUNTRY_AVAILABILITY_CHECKED: 'card_country_availability_checked',
  CARD_COUNTRY_CHANGE_PRESSED: 'card_country_change_pressed',
  CARD_KYC_FLOW_TRIGGERED: 'card_kyc_flow_triggered',
  CARD_KYC_COUNTRY_DETECTION_FAILED: 'card_kyc_country_detection_failed',
  CARD_KYC_COUNTRY_NOT_SUPPORTED: 'card_kyc_country_not_supported',
  CARD_COUNTRY_CHECK_STARTED: 'card_country_check_started',
  CARD_COUNTRY_CHECK_IP_FETCHED: 'card_country_check_ip_fetched',
  CARD_COUNTRY_CHECK_IP_FAILED: 'card_country_check_ip_failed',
  CARD_COUNTRY_CHECK_DETECTED: 'card_country_check_detected',
  CARD_KYC_COUNTRY_SUPPORTED: 'card_kyc_country_supported',
  CARD_COUNTRY_CHECK_FAILED: 'card_country_check_failed',
  CARD_ACTIVATE_PAGE_VIEWED: 'card_activate_page_viewed',
  USER_KYC_INFO_PAGE_VIEWED: 'user_kyc_info_page_viewed',
  USER_KYC_INFO_FORM_STARTED: 'user_kyc_info_form_started',
  KYC_STEP_STARTED: 'kyc_step_started',
  KYC_STEP_COMPLETED: 'kyc_step_completed',

  // KYC Link Events (for debugging KYC flow issues)
  KYC_LINK_PAGE_LOADED: 'kyc_link_page_loaded',
  KYC_LINK_PARSED: 'kyc_link_parsed',
  KYC_LINK_SDK_READY: 'kyc_link_sdk_ready',
  KYC_LINK_COMPLETED: 'kyc_link_completed',
  KYC_LINK_CANCELLED: 'kyc_link_cancelled',
  KYC_LINK_ERROR: 'kyc_link_error',

  // Fingerprint Events
  FINGERPRINT_OBSERVED_BEFORE_KYC: 'fingerprint_observed_before_kyc',

  CARD_ACTIVATION_STARTED: 'card_activation_started',
  CARD_ACTIVATION_SUCCEEDED: 'card_activation_succeeded',
  CARD_ACTIVATION_FAILED: 'card_activation_failed',

  // Card Deposit Events
  CARD_DEPOSIT_STARTED: 'card_deposit_started',
  CARD_DEPOSIT_TRANSACTION_SENT: 'card_deposit_transaction_sent',
  CARD_DEPOSIT_COMPLETED: 'card_deposit_completed',
  CARD_DEPOSIT_FAILED: 'card_deposit_failed',

  // Card Deposit Funnel Events
  // Funnel Entry
  CARD_DEPOSIT_MODAL_OPENED: 'card_deposit_modal_opened',
  CARD_DEPOSIT_MODAL_CLOSED: 'card_deposit_modal_closed',
  CARD_DEPOSIT_OPTION_SELECTED: 'card_deposit_option_selected',

  // Internal Deposit Flow
  CARD_DEPOSIT_INTERNAL_FORM_VIEWED: 'card_deposit_internal_form_viewed',
  CARD_DEPOSIT_SOURCE_SELECTED: 'card_deposit_source_selected',
  CARD_DEPOSIT_AMOUNT_ENTRY_STARTED: 'card_deposit_amount_entry_started',
  CARD_DEPOSIT_MAX_BUTTON_CLICKED: 'card_deposit_max_button_clicked',
  CARD_DEPOSIT_BORROW_SLIDER_CHANGED: 'card_deposit_borrow_slider_changed',
  CARD_DEPOSIT_VALIDATION_ERROR: 'card_deposit_validation_error',
  CARD_DEPOSIT_INTERNAL_SUBMITTED: 'card_deposit_internal_submitted',

  // External Deposit Flow
  CARD_DEPOSIT_EXTERNAL_FORM_VIEWED: 'card_deposit_external_form_viewed',
  CARD_DEPOSIT_EXTERNAL_WALLET_CONNECTED: 'card_deposit_external_wallet_connected',
  CARD_DEPOSIT_EXTERNAL_WALLET_DISCONNECTED: 'card_deposit_external_wallet_disconnected',
  CARD_DEPOSIT_EXTERNAL_SUBMITTED: 'card_deposit_external_submitted',

  // Transaction Status
  CARD_DEPOSIT_TRANSACTION_STATUS_VIEWED: 'card_deposit_transaction_status_viewed',
  CARD_DEPOSIT_TRANSACTION_STATUS_PRESSED: 'card_deposit_transaction_status_pressed',

  // Fast Withdraw Events
  FAST_WITHDRAW_INITIATED: 'fast_withdraw_initiated',
  FAST_WITHDRAW_TRANSACTION_SENT: 'fast_withdraw_transaction_sent',
  FAST_WITHDRAW_COMPLETED: 'fast_withdraw_completed',
  FAST_WITHDRAW_FAILED: 'fast_withdraw_failed',
  FAST_WITHDRAW_CANCELLED: 'fast_withdraw_cancelled',

  // Global / Error Events
  ERROR_BOUNDARY: 'error_boundary',
  RETRY_ATTEMPTED: 'retry_attempted',

  // QR Scanner Events
  QR_SCANNER_OPENED: 'qr_scanner_opened',
  QR_SCANNER_CLOSED: 'qr_scanner_closed',
  QR_CODE_SCANNED: 'qr_code_scanned',
  QR_CODE_SCAN_SUCCESS: 'qr_code_scan_success',
  QR_CODE_SCAN_FAILED: 'qr_code_scan_failed',
  QR_SCANNER_FLASH_TOGGLED: 'qr_scanner_flash_toggled',
  QR_SCANNER_PERMISSION_REQUESTED: 'qr_scanner_permission_requested',
  QR_SCANNER_PERMISSION_GRANTED: 'qr_scanner_permission_granted',
  QR_SCANNER_PERMISSION_DENIED: 'qr_scanner_permission_denied',
} as const;

export type TrackingEvent = (typeof TRACKING_EVENTS)[keyof typeof TRACKING_EVENTS];
