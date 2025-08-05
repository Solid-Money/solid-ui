import { Href, Route } from "expo-router";

type Path = {
  REGISTER: Href;
  WELCOME: Href;
  HOME: Href;
  WALLET: Href;
  DEPOSIT: Href;
  SEND: Href;
  CARD: Href;
  CARD_ACTIVATE: Route;
  CARD_KYC: Route;
  CARD_TERMS_OF_SERVICE: Route;
  CARD_DETAILS: Route;
  CARD_ACTIVATE_MOBILE: Href;
  CARD_USER_INFO_MOBILE: Route;
  CARD_KYC_MOBILE: Href;
  EARN: Href;
  BUY_CRYPTO: Href;
  SETTINGS: Href;
  NOTIFICATIONS: Href;
  PASSKEY_NOT_SUPPORTED: Href;
}

export const path: Path = {
  REGISTER: "/register",
  WELCOME: "/welcome",
  HOME: "/",
  WALLET: "/wallet",
  DEPOSIT: "/deposit",
  SEND: "/send",
  CARD: "/card",
  CARD_ACTIVATE: "/card/activate",
  CARD_KYC: "/card/kyc",
  CARD_TERMS_OF_SERVICE: "/card/bridge_terms_of_service",
  CARD_DETAILS: "/card/details",
  CARD_ACTIVATE_MOBILE: "/card/activate_mobile",
  CARD_USER_INFO_MOBILE: "/card/user_info_mobile",
  CARD_KYC_MOBILE: "/card/kyc_mobile",
  EARN: "/earn",
  BUY_CRYPTO: "/buy-crypto",
  SETTINGS: "/settings",
  NOTIFICATIONS: "/notifications",
  PASSKEY_NOT_SUPPORTED: "/passkey-not-supported",
}
