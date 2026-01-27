import { Href, Route } from 'expo-router';

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
  ACTIVITY: Href;
  DEPOSIT: Href;
  CARD: Href;
  USER_KYC_INFO: Href;
  BANK_TRANSFER: Href;
  KYC: Href;
  CARD_TERMS_OF_SERVICE: Route;
  CARD_DETAILS: Route;
  CARD_DEPOSIT: Route;
  CARD_TRANSACTIONS: Route;
  CARD_ACTIVATE: Href;
  CARD_ACTIVATE_COUNTRY_SELECTION: Href;
  CARD_KYC_MOBILE: Href;
  CARD_COUNTRY_SELECTION: Href;
  EARN: Href;
  SETTINGS: Href;
  NOTIFICATIONS: Href;
  PASSKEY_NOT_SUPPORTED: Href;
  POINTS: Href;
  REFERRAL: Href;
  POINTS_LEADERBOARD: Href;
  REWARDS: Href;
  REWARDS_BENEFITS: Href;
  OVERVIEW: Href;
  CARD_WAITLIST: Href;
  CARD_WAITLIST_SUCCESS: Href;
  CARD_COUNTRY_VERIFICATION_REQUIRED: Href;
  RECOVERY: Route;
  ADD_REFERRER: Href;
  QUEST_WALLET: Route;
  QR_SCANNER: Route;
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
  ACTIVITY: '/activity',
  DEPOSIT: '/deposit',
  CARD: '/card',
  USER_KYC_INFO: '/user-kyc-info',
  KYC: '/kyc',
  BANK_TRANSFER: '/bank-transfer',
  CARD_TERMS_OF_SERVICE: '/card/bridge_terms_of_service',
  CARD_DETAILS: '/card/details',
  CARD_DEPOSIT: '/card/deposit',
  CARD_TRANSACTIONS: '/card/details/transactions',
  CARD_ACTIVATE: '/card/activate',
  CARD_ACTIVATE_COUNTRY_SELECTION: '/card/activate/country_selection',
  CARD_KYC_MOBILE: '/card/kyc_mobile',
  CARD_COUNTRY_SELECTION: '/card-onboard/country_selection',
  EARN: '/earn',
  SETTINGS: '/settings',
  NOTIFICATIONS: '/notifications',
  PASSKEY_NOT_SUPPORTED: '/passkey-not-supported',
  POINTS: '/points',
  REFERRAL: '/referral',
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
};
