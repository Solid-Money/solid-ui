import { Href, Route } from 'expo-router';

type Path = {
  ONBOARDING: Href;
  REGISTER: Route;
  WELCOME: Href;
  HOME: Href;
  SAVINGS: Href;
  ACTIVITY: Href;
  WALLET: Href;
  DEPOSIT: Href;
  SEND: Href;
  SWAP: Href;
  CARD: Href;
  USER_KYC_INFO: Href;
  BANK_TRANSFER: Href;
  CARD_ACTIVATE: Route;
  KYC: Href;
  CARD_TERMS_OF_SERVICE: Route;
  CARD_DETAILS: Route;
  CARD_DEPOSIT: Route;
  CARD_TRANSACTIONS: Route;
  CARD_ACTIVATE_MOBILE: Href;
  CARD_KYC_MOBILE: Href;
  CARD_COUNTRY_SELECTION: Href;
  EARN: Href;
  BUY_CRYPTO: Href;
  SETTINGS: Href;
  NOTIFICATIONS: Href;
  PASSKEY_NOT_SUPPORTED: Href;
  POINTS: Href;
  REFERRAL: Href;
  INVITE: Href;
  POINTS_LEADERBOARD: Href;
  OVERVIEW: Href;
  CARD_WAITLIST: Href;
  CARD_WAITLIST_SUCCESS: Href;
};

export const path: Path = {
  ONBOARDING: '/onboarding',
  REGISTER: '/register',
  WELCOME: '/welcome',
  HOME: '/',
  SAVINGS: '/savings',
  ACTIVITY: '/activity',
  WALLET: '/wallet',
  DEPOSIT: '/deposit',
  SEND: '/send',
  SWAP: '/swap',
  CARD: '/card',
  USER_KYC_INFO: '/user-kyc-info',
  KYC: '/kyc',
  BANK_TRANSFER: '/bank-transfer',
  CARD_TERMS_OF_SERVICE: '/card/bridge_terms_of_service',
  CARD_DETAILS: '/card/details',
  CARD_DEPOSIT: '/card/deposit',
  CARD_TRANSACTIONS: '/card/details/transactions',
  CARD_ACTIVATE_MOBILE: '/card/activate_mobile',
  CARD_KYC_MOBILE: '/card/kyc_mobile',
  CARD_COUNTRY_SELECTION: '/card/country_selection',
  EARN: '/earn',
  BUY_CRYPTO: '/buy-crypto',
  SETTINGS: '/settings',
  NOTIFICATIONS: '/notifications',
  PASSKEY_NOT_SUPPORTED: '/passkey-not-supported',
  POINTS: '/points',
  REFERRAL: '/referral',
  INVITE: '/invite',
  POINTS_LEADERBOARD: '/points/leaderboard',
  OVERVIEW: '/overview',
  CARD_WAITLIST: '/card-waitlist',
  CARD_WAITLIST_SUCCESS: '/card-waitlist/success',
};
