/**
 * What the user was trying to do when something failed.
 *
 * The title says what failed, in the user's terms: "Couldn’t move to your card",
 * never "Move failed" or "Error" (Figma: Toasts & error states). `money` marks a
 * failed money action, which always gets the failure sheet with Try again and
 * Contact support — never a toast.
 */
interface ErrorActionMeta {
  /** ≤ 40 characters. */
  title: string;
  /** How support reads it in the prefilled chat message. */
  label: string;
  money: boolean;
}

export const ERROR_ACTIONS = {
  // Money actions — failure sheet.
  move_to_card: { title: 'Couldn’t move to your card', label: 'Move to card', money: true },
  card_deposit: { title: 'Couldn’t add funds to your card', label: 'Card deposit', money: true },
  card_withdraw: {
    title: 'Couldn’t withdraw from your card',
    label: 'Card withdrawal',
    money: true,
  },
  card_repay: { title: 'Couldn’t repay your card', label: 'Card repayment', money: true },
  credit_line: { title: 'Couldn’t update your credit line', label: 'Credit line', money: true },
  deposit: { title: 'Couldn’t complete your deposit', label: 'Deposit', money: true },
  savings_deposit: { title: 'Couldn’t add to your savings', label: 'Savings deposit', money: true },
  withdraw: { title: 'Couldn’t withdraw', label: 'Withdrawal', money: true },
  send: { title: 'Couldn’t send', label: 'Send', money: true },
  swap: { title: 'Couldn’t swap', label: 'Swap', money: true },
  bridge: { title: 'Couldn’t move your funds', label: 'Bridge', money: true },
  claim: { title: 'Couldn’t claim', label: 'Claim', money: true },
  agent_fund: { title: 'Couldn’t fund your agent', label: 'Agent funding', money: true },
  rescue_token: { title: 'Couldn’t recover your tokens', label: 'Token recovery', money: true },

  // Everything else — toast or inline.
  card_order: { title: 'Couldn’t order your card', label: 'Card order', money: false },
  card_activate: { title: 'Couldn’t activate your card', label: 'Card activation', money: false },
  card_reveal: { title: 'Couldn’t show your card details', label: 'Card details', money: false },
  card_settings: { title: 'Couldn’t update your card', label: 'Card settings', money: false },
  add_to_wallet: {
    title: 'Couldn’t add your card to Wallet',
    label: 'Add to Wallet',
    money: false,
  },
  kyc: { title: 'Couldn’t start verification', label: 'Verification', money: false },
  sign_in: { title: 'Couldn’t sign you in', label: 'Sign in', money: false },
  sign_up: { title: 'Couldn’t create your account', label: 'Sign up', money: false },
  passkey: { title: 'Couldn’t use your passkey', label: 'Passkey', money: false },
  account: { title: 'Couldn’t update your account', label: 'Account', money: false },
  referral: { title: 'Couldn’t add the referral', label: 'Referral', money: false },
  subscription: { title: 'Couldn’t update your plan', label: 'Plan', money: false },
  load: { title: 'Couldn’t load this', label: 'Loading', money: false },
  refresh: { title: 'Couldn’t refresh', label: 'Refresh', money: false },
  generic: { title: 'Something went wrong', label: 'App', money: false },
} as const satisfies Record<string, ErrorActionMeta>;

export type ErrorAction = keyof typeof ERROR_ACTIONS;

export const isMoneyAction = (action: ErrorAction): boolean => ERROR_ACTIONS[action].money;
