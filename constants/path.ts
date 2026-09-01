import { Href, Route } from 'expo-router';

/**
 * Value of the wallet screen's `screen` query param that opens the card details
 * pane — i.e. `/?screen=card-info`. Exported so the wallet screen matches on the
 * same constant the links are built from.
 */
export const CARD_INFO_SCREEN = 'card-info';

type Path = {
  ONBOARDING: Href;
  WELCOME: Href;
  HOME: Href;
  // Email-first signup flow
  SIGNUP_EMAIL: Href;
  SIGNUP_OTP: Href;
  SIGNUP_CREATING: Href;
  SIGNUP_PASSKEY: Href;
  SAVINGS: Href;
  /** Savings with the FUSE vault preselected (rewards "skip the line" CTA). */
  SAVINGS_FUSE: Href;
  SAVINGS_OLD: Href;
  ACTIVITY: Href;
  DEPOSIT: Href;
  /**
   * @deprecated Not a page any more — `/card` is a redirect shim that branches on
   * card status (details / activate / country selection) so old deep links keep
   * working. New navigation should name the destination directly:
   * `CARD_COUNTRY_SELECTION` to start onboarding, `CARD_ACTIVATE` to resume
   * issuance, `CARD_DETAILS` for an existing card.
   */
  CARD: Href;
  USER_KYC_INFO: Href;
  BANK_TRANSFER: Href;
  KYC: Href;
  SUMSUB_KYC: Href;
  BRIDGE_KYC: Href;
  CARD_TERMS_OF_SERVICE: Route;
  /**
   * @deprecated Not a user-reachable page any more — `/card/details` is a
   * redirect shim onto `CARD_INFO` so old deep links, push payloads and
   * bookmarks keep working. Navigate to `CARD_INFO` instead.
   */
  CARD_DETAILS: Route;
  /**
   * The card details surface: the wallet screen with its card pane open. The
   * pane is a layer on the wallet rather than a route of its own (that's what
   * lets the card fly into place without a screen mounting underneath it), so
   * the "page" is addressed by a query param the wallet reads on mount.
   */
  CARD_INFO: Href;
  CARD_DEPOSIT: Route;
  CARD_TRANSACTIONS: Route;
  CARD_READY: Href;
  CARD_PENDING: Href;
  /**
   * Pending 3D Secure challenges on a Wirex card. Reachable from the card screen
   * as well as from the push, because Wirex never retries a webhook it failed to
   * deliver and a challenge nobody was told about still has to be answerable.
   */
  CARD_3DS: Href;
  CARD_ACTIVATE: Href;
  CARD_KYC_MOBILE: Href;
  CARD_COUNTRY_SELECTION: Href;
  EARN: Href;
  SETTINGS: Href;
  NOTIFICATIONS: Href;
  PASSKEY_NOT_SUPPORTED: Href;
  POINTS: Href;
  REFERRAL: Href;
  /** Deep link that opens the referral program popup on the rewards screen. */
  REFERRAL_PROGRAM: Href;
  POINTS_LEADERBOARD: Href;
  REWARDS: Href;
  REWARDS_BENEFITS: Href;
  OVERVIEW: Href;
  /**
   * @deprecated Same story as `CARD` — `/card-onboard` served the standalone card
   * waitlist page and is now a shim that hands off to `/card`. Name a real
   * destination instead: `CARD_COUNTRY_SELECTION`, `CARD_ACTIVATE` or
   * `CARD_DETAILS`.
   */
  CARD_WAITLIST: Href;
  CARD_WAITLIST_SUCCESS: Href;
  CARD_COUNTRY_VERIFICATION_REQUIRED: Href;
  RECOVERY: Route;
  ADD_REFERRER: Href;
  QUEST_WALLET: Route;
  QR_SCANNER: Route;
  RESCUE_TOKEN: Href;
  AGENT: Href;
  GOODDOLLAR: Href;
  STOCKS: Href;
};

export const path: Path = {
  ONBOARDING: '/onboarding',
  WELCOME: '/welcome',
  HOME: '/',
  // Email-first signup flow
  SIGNUP_EMAIL: '/signup/email',
  SIGNUP_OTP: '/signup/otp',
  SIGNUP_CREATING: '/signup/creating',
  SIGNUP_PASSKEY: '/signup/passkey',
  SAVINGS: '/savings',
  SAVINGS_FUSE: { pathname: '/savings', params: { vault: 'fuse' } } as Href,
  SAVINGS_OLD: '/savings-old',
  ACTIVITY: '/activity',
  DEPOSIT: '/deposit',
  CARD: '/card',
  USER_KYC_INFO: '/user-kyc-info',
  KYC: '/kyc',
  SUMSUB_KYC: '/sumsub-kyc',
  BRIDGE_KYC: '/bridge-kyc',
  BANK_TRANSFER: '/bank-transfer',
  CARD_TERMS_OF_SERVICE: '/card/bridge_terms_of_service',
  CARD_DETAILS: '/card/details',
  CARD_INFO: { pathname: '/', params: { screen: CARD_INFO_SCREEN } } as Href,
  CARD_DEPOSIT: '/card/deposit',
  CARD_TRANSACTIONS: '/card/details/transactions',
  CARD_READY: '/card/ready' as Href,
  CARD_PENDING: '/card/pending' as Href,
  CARD_3DS: '/card/3ds' as Href,
  CARD_ACTIVATE: '/card/activate',
  CARD_KYC_MOBILE: '/card/kyc_mobile',
  CARD_COUNTRY_SELECTION: '/card-onboard/country_selection',
  EARN: '/earn',
  SETTINGS: '/settings',
  NOTIFICATIONS: '/notifications',
  PASSKEY_NOT_SUPPORTED: '/passkey-not-supported',
  POINTS: '/points',
  REFERRAL: '/referral',
  REFERRAL_PROGRAM: { pathname: '/rewards', params: { referral: 'open' } } as Href,
  POINTS_LEADERBOARD: '/points/leaderboard',
  REWARDS: '/rewards',
  REWARDS_BENEFITS: '/rewards/benefits',
  OVERVIEW: '/overview',
  CARD_WAITLIST: '/card-onboard',
  CARD_WAITLIST_SUCCESS: '/card-onboard/success',
  // Note: Type assertion needed because Expo Router types are regenerated at dev server start
  CARD_COUNTRY_VERIFICATION_REQUIRED: '/card-onboard/country-verification-required' as Href,
  RECOVERY: '/recovery',
  ADD_REFERRER: '/add-referrer',
  QUEST_WALLET: '/quest-wallet',
  // Note: Type assertion needed because Expo Router types are regenerated at dev server start
  QR_SCANNER: '/qr-scanner' as Route,
  RESCUE_TOKEN: '/rescue-token' as Href,
  AGENT: '/agent' as Href,
  GOODDOLLAR: '/gooddollar' as Href,
  STOCKS: '/stocks' as Href,
};

/**
 * The decision screen for one 3D Secure challenge.
 *
 * A function rather than a constant because the transaction id is the whole
 * address: this is where a 3DS push lands, and it has to land on the challenge
 * the merchant is holding, not on the list.
 *
 * `preview` carries what the push already knew — the amount and the merchant —
 * so the screen has something to render while the authoritative pending list
 * loads behind it. A 3DS challenge is on the merchant's clock; a spinner spends
 * time the cardholder does not have. Undefined fields are dropped rather than
 * passed, so they never reach the URL as the string "undefined".
 */
export const cardThreeDsRequestPath = (
  transactionId: string,
  preview?: {
    amount?: string;
    currency?: string;
    merchantName?: string;
    cardLast4?: string;
  },
): Href =>
  ({
    pathname: '/card/3ds/[transactionId]',
    params: {
      transactionId,
      ...Object.fromEntries(Object.entries(preview ?? {}).filter(([, value]) => Boolean(value))),
    },
    // Expo Router's generated route types are rebuilt when the dev server
    // starts, so a route added in the same change is not in them yet.
  }) as unknown as Href;
