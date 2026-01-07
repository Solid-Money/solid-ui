import { Platform } from 'react-native';
import { EXPO_PUBLIC_ASSETS_CDN_URL } from './config';

/**
 * Registry of all local assets.
 */
export const ASSETS = {
  // @assets-registry-start
  'animations/card.json': require('@/assets/animations/card.json'),
  'animations/lightning.json': require('@/assets/animations/lightning.json'),
  'animations/rocket.json': require('@/assets/animations/rocket.json'),
  'animations/vault.json': require('@/assets/animations/vault.json'),
  'fonts/SpaceMono-Regular.ttf': require('@/assets/fonts/SpaceMono-Regular.ttf'),
  'images/activate_card.png': require('@/assets/images/activate_card.png'),
  'images/activate_card_desktop.png': require('@/assets/images/activate_card_desktop.png'),
  'images/activate_card_steps.png': require('@/assets/images/activate_card_steps.png'),
  'images/adaptive-icon.png': require('@/assets/images/adaptive-icon.png'),
  'images/apple-google-pay.png': require('@/assets/images/apple-google-pay.png'),
  'images/apple_pay.png': require('@/assets/images/apple_pay.png'),
  'images/arbitrum.png': require('@/assets/images/arbitrum.png'),
  'images/auto-finance.jpg': require('@/assets/images/auto-finance.jpg'),
  'images/avantis.png': require('@/assets/images/avantis.png'),
  'images/backspace.png': require('@/assets/images/backspace.png'),
  'images/bank_deposit.png': require('@/assets/images/bank_deposit.png'),
  'images/base.png': require('@/assets/images/base.png'),
  'images/bitcoin-usdc-4x.png': require('@/assets/images/bitcoin-usdc-4x.png'),
  'images/buy_crypto.png': require('@/assets/images/buy_crypto.png'),
  'images/card-earn.png': require('@/assets/images/card-earn.png'),
  'images/card-effortless.png': require('@/assets/images/card-effortless.png'),
  'images/card-global.png': require('@/assets/images/card-global.png'),
  'images/card-onboarding.png': require('@/assets/images/card-onboarding.png'),
  'images/card-safe.png': require('@/assets/images/card-safe.png'),
  'images/card_actions_details.png': require('@/assets/images/card_actions_details.png'),
  'images/card_actions_freeze.png': require('@/assets/images/card_actions_freeze.png'),
  'images/card_actions_fund.png': require('@/assets/images/card_actions_fund.png'),
  'images/card_benefits_one.png': require('@/assets/images/card_benefits_one.png'),
  'images/card_benefits_three.png': require('@/assets/images/card_benefits_three.png'),
  'images/card_benefits_two.png': require('@/assets/images/card_benefits_two.png'),
  'images/card_details.png': require('@/assets/images/card_details.png'),
  'images/card_frozen.png': require('@/assets/images/card_frozen.png'),
  'images/cards-banner.png': require('@/assets/images/cards-banner.png'),
  'images/cards-desktop.png': require('@/assets/images/cards-desktop.png'),
  'images/cards-mobile.png': require('@/assets/images/cards-mobile.png'),
  'images/cards.png': require('@/assets/images/cards.png'),
  'images/deposit-green.png': require('@/assets/images/deposit-green.png'),
  'images/deposit-purple.png': require('@/assets/images/deposit-purple.png'),
  'images/deposit.png': require('@/assets/images/deposit.png'),
  'images/deposit_banner.png': require('@/assets/images/deposit_banner.png'),
  'images/deposit_from_external_wallet.png': require('@/assets/images/deposit_from_external_wallet.png'),
  'images/deposit_image.png': require('@/assets/images/deposit_image.png'),
  'images/diamond.png': require('@/assets/images/diamond.png'),
  'images/dollar-yellow.png': require('@/assets/images/dollar-yellow.png'),
  'images/earn-green.png': require('@/assets/images/earn-green.png'),
  'images/earn-purple.png': require('@/assets/images/earn-purple.png'),
  'images/earn.png': require('@/assets/images/earn.png'),
  'images/email.png': require('@/assets/images/email.png'),
  'images/eth-bitcoin-usdc-4x.png': require('@/assets/images/eth-bitcoin-usdc-4x.png'),
  'images/eth-fuse-usdc-4x.png': require('@/assets/images/eth-fuse-usdc-4x.png'),
  'images/eth.png': require('@/assets/images/eth.png'),
  'images/ethereum-square-4x.png': require('@/assets/images/ethereum-square-4x.png'),
  'images/exclamation-warning.png': require('@/assets/images/exclamation-warning.png'),
  'images/exclamation_mark.png': require('@/assets/images/exclamation_mark.png'),
  'images/favicon.png': require('@/assets/images/favicon.png'),
  'images/freeze_button_icon.png': require('@/assets/images/freeze_button_icon.png'),
  'images/fund-wallet-tokens.png': require('@/assets/images/fund-wallet-tokens.png'),
  'images/fund_image.png': require('@/assets/images/fund_image.png'),
  'images/fund_your_wallet_large.png': require('@/assets/images/fund_your_wallet_large.png'),
  'images/fuse-4x.png': require('@/assets/images/fuse-4x.png'),
  'images/fuse.png': require('@/assets/images/fuse.png'),
  'images/google_pay.png': require('@/assets/images/google_pay.png'),
  'images/grant_notifications.png': require('@/assets/images/grant_notifications.png'),
  'images/green-diamond.png': require('@/assets/images/green-diamond.png'),
  'images/green_onboarding_bg.png': require('@/assets/images/green_onboarding_bg.png'),
  'images/ipor-fusion.png': require('@/assets/images/ipor-fusion.png'),
  'images/kyc_under_review.png': require('@/assets/images/kyc_under_review.png'),
  'images/merkl.png': require('@/assets/images/merkl.png'),
  'images/morpho.png': require('@/assets/images/morpho.png'),
  'images/no_funds_deposit_icon.png': require('@/assets/images/no_funds_deposit_icon.png'),
  'images/no_funds_earn_icon.png': require('@/assets/images/no_funds_earn_icon.png'),
  'images/no_funds_withdraw_icon.png': require('@/assets/images/no_funds_withdraw_icon.png'),
  'images/onboarding_solid.png': require('@/assets/images/onboarding_solid.png'),
  'images/one-percent-cashback.png': require('@/assets/images/one-percent-cashback.png'),
  'images/overview-reallocation.png': require('@/assets/images/overview-reallocation.png'),
  'images/overview-risk-adjusted.png': require('@/assets/images/overview-risk-adjusted.png'),
  'images/overview-withdraw.png': require('@/assets/images/overview-withdraw.png'),
  'images/pendle.png': require('@/assets/images/pendle.png'),
  'images/points-star.png': require('@/assets/images/points-star.png'),
  'images/points_large.png': require('@/assets/images/points_large.png'),
  'images/polygon.png': require('@/assets/images/polygon.png'),
  'images/public_address.png': require('@/assets/images/public_address.png'),
  'images/purple_onboarding_bg.png': require('@/assets/images/purple_onboarding_bg.png'),
  'images/question-mark-gray.png': require('@/assets/images/question-mark-gray.png'),
  'images/question-mark.png': require('@/assets/images/question-mark.png'),
  'images/refer_friend.png': require('@/assets/images/refer_friend.png'),
  'images/referral_large.png': require('@/assets/images/referral_large.png'),
  'images/reveal_card_details_icon.png': require('@/assets/images/reveal_card_details_icon.png'),
  'images/security_email.png': require('@/assets/images/security_email.png'),
  'images/security_key.png': require('@/assets/images/security_key.png'),
  'images/security_totp.png': require('@/assets/images/security_totp.png'),
  'images/security_unlock.png': require('@/assets/images/security_unlock.png'),
  'images/settings_account_details.png': require('@/assets/images/settings_account_details.png'),
  'images/settings_help_and_support.png': require('@/assets/images/settings_help_and_support.png'),
  'images/settings_logout.png': require('@/assets/images/settings_logout.png'),
  'images/settings_security.png': require('@/assets/images/settings_security.png'),
  'images/settings_wallet_address.png': require('@/assets/images/settings_wallet_address.png'),
  'images/solid-4x.png': require('@/assets/images/solid-4x.png'),
  'images/solid-black-large.png': require('@/assets/images/solid-black-large.png'),
  'images/solid-dark-purple.png': require('@/assets/images/solid-dark-purple.png'),
  'images/solid-green.png': require('@/assets/images/solid-green.png'),
  'images/solid-indigo.png': require('@/assets/images/solid-indigo.png'),
  'images/solid-logo-4x.png': require('@/assets/images/solid-logo-4x.png'),
  'images/solid-logo.png': require('@/assets/images/solid-logo.png'),
  'images/solid-purple-large.png': require('@/assets/images/solid-purple-large.png'),
  'images/solid.png': require('@/assets/images/solid.png'),
  'images/solid_logo_with_glare.png': require('@/assets/images/solid_logo_with_glare.png'),
  'images/sousd-4x.png': require('@/assets/images/sousd-4x.png'),
  'images/splash-icon.png': require('@/assets/images/splash-icon.png'),
  'images/star-bronze.png': require('@/assets/images/star-bronze.png'),
  'images/star-gold.png': require('@/assets/images/star-gold.png'),
  'images/star-silver.png': require('@/assets/images/star-silver.png'),
  'images/star.png': require('@/assets/images/star.png'),
  'images/swap_circle.png': require('@/assets/images/swap_circle.png'),
  'images/three-percent.png': require('@/assets/images/three-percent.png'),
  'images/usdc-4x.png': require('@/assets/images/usdc-4x.png'),
  'images/usdc.png': require('@/assets/images/usdc.png'),
  'images/usds.png': require('@/assets/images/usds.png'),
  'images/usdt.png': require('@/assets/images/usdt.png'),
  'images/veda.png': require('@/assets/images/veda.png'),
  'images/wallet_connect.png': require('@/assets/images/wallet_connect.png'),
  'images/withdraw-green.png': require('@/assets/images/withdraw-green.png'),
  'images/withdraw-purple.png': require('@/assets/images/withdraw-purple.png'),
  'images/withdraw.png': require('@/assets/images/withdraw.png'),
  'images/yellow_onboarding_bg.png': require('@/assets/images/yellow_onboarding_bg.png'),
  'splash/splash-icon.png': require('@/assets/splash/splash-icon.png'),
  // @assets-registry-end
} as const;

export type AssetPath = keyof typeof ASSETS;

/**
 * New simplified helper that uses the registry for type-safe asset loading.
 * Usage: getAsset('images/usdc.png')
 */
export const getAsset = (path: AssetPath) => {
  const localAsset = ASSETS[path];

  if (!localAsset) {
    console.error(`Asset not found in registry: ${path}`);
    return null;
  }

  // Only use CDN on Web. Mobile should always use local bundled assets.
  const isWeb = Platform.OS === 'web';
  const shouldUseCDN = isWeb && EXPO_PUBLIC_ASSETS_CDN_URL && !__DEV__;

  if (shouldUseCDN) {
    return { uri: `${EXPO_PUBLIC_ASSETS_CDN_URL}/${path}` };
  }

  return localAsset;
};

/**
 * Helper to get a direct CDN URL string.
 * Useful for components that require a string URL instead of an asset object.
 */
export const getImageUrl = (path: AssetPath) => {
  if (!ASSETS[path]) {
    console.error(`Asset not found in registry: ${path}`);
    return '';
  }

  // Only use CDN on Web.
  const isWeb = Platform.OS === 'web';
  const shouldUseCDN = isWeb && EXPO_PUBLIC_ASSETS_CDN_URL && !__DEV__;

  if (shouldUseCDN) {
    return `${EXPO_PUBLIC_ASSETS_CDN_URL}/${path}`;
  }

  return '';
};
