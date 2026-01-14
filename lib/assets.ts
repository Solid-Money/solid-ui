/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';
import { EXPO_PUBLIC_BASE_URL } from './config';

/**
 * Registry of all local assets.
 */
export const ASSETS = {
  // @assets-registry-start
  'animations/card.json': { module: require('@/assets/animations/card.json'), hash: 'ea9c0b6b' },
  'animations/lightning.json': {
    module: require('@/assets/animations/lightning.json'),
    hash: '234b6520',
  },
  'animations/rocket.json': {
    module: require('@/assets/animations/rocket.json'),
    hash: '48d71bbc',
  },
  'animations/vault.json': { module: require('@/assets/animations/vault.json'), hash: '85dffdd4' },
  'fonts/SpaceMono-Regular.ttf': {
    module: require('@/assets/fonts/SpaceMono-Regular.ttf'),
    hash: '4c322514',
  },
  'images/Plus.tsx': { module: require('@/assets/images/Plus.tsx'), hash: '733906a0' },
  'images/activate_card.png': {
    module: require('@/assets/images/activate_card.png'),
    hash: '5dfaebb9',
  },
  'images/activate_card_desktop.png': {
    module: require('@/assets/images/activate_card_desktop.png'),
    hash: '9cba90d1',
  },
  'images/activate_card_steps.png': {
    module: require('@/assets/images/activate_card_steps.png'),
    hash: 'f37e1218',
  },
  'images/activity-nav-bar-icon.tsx': {
    module: require('@/assets/images/activity-nav-bar-icon.tsx'),
    hash: '53f2f412',
  },
  'images/adaptive-icon.png': {
    module: require('@/assets/images/adaptive-icon.png'),
    hash: '9750723d',
  },
  'images/apple-google-pay.png': {
    module: require('@/assets/images/apple-google-pay.png'),
    hash: '5a4d6b29',
  },
  'images/apple_pay.png': { module: require('@/assets/images/apple_pay.png'), hash: 'c12b79b1' },
  'images/arbitrum.png': { module: require('@/assets/images/arbitrum.png'), hash: 'f6ebb536' },
  'images/assets-nav-bar-icon.tsx': {
    module: require('@/assets/images/assets-nav-bar-icon.tsx'),
    hash: '7f80b140',
  },
  'images/auto-finance.jpg': {
    module: require('@/assets/images/auto-finance.jpg'),
    hash: '9e569f44',
  },
  'images/avantis.png': { module: require('@/assets/images/avantis.png'), hash: '1aad6bc0' },
  'images/backspace.png': { module: require('@/assets/images/backspace.png'), hash: '46dc5885' },
  'images/bank_deposit.png': {
    module: require('@/assets/images/bank_deposit.png'),
    hash: '96c19d92',
  },
  'images/base.png': { module: require('@/assets/images/base.png'), hash: '7a2c8627' },
  'images/bitcoin-usdc-4x.png': {
    module: require('@/assets/images/bitcoin-usdc-4x.png'),
    hash: '746b1f64',
  },
  'images/brl-fiat-currency.tsx': {
    module: require('@/assets/images/brl-fiat-currency.tsx'),
    hash: '75a2ebe8',
  },
  'images/buy_crypto.png': { module: require('@/assets/images/buy_crypto.png'), hash: 'a072a946' },
  'images/card-earn.png': { module: require('@/assets/images/card-earn.png'), hash: '3e55e4d1' },
  'images/card-effortless.png': {
    module: require('@/assets/images/card-effortless.png'),
    hash: '532402c1',
  },
  'images/card-global.png': {
    module: require('@/assets/images/card-global.png'),
    hash: '80bbf480',
  },
  'images/card-nav-bar-icon.tsx': {
    module: require('@/assets/images/card-nav-bar-icon.tsx'),
    hash: '2bbae9c2',
  },
  'images/card-onboarding.png': {
    module: require('@/assets/images/card-onboarding.png'),
    hash: '57d7012d',
  },
  'images/card-safe.png': { module: require('@/assets/images/card-safe.png'), hash: '530d8970' },
  'images/card.tsx': { module: require('@/assets/images/card.tsx'), hash: '896e9355' },
  'images/card_actions_details.png': {
    module: require('@/assets/images/card_actions_details.png'),
    hash: 'fb7a688b',
  },
  'images/card_actions_freeze.png': {
    module: require('@/assets/images/card_actions_freeze.png'),
    hash: '9ebcb925',
  },
  'images/card_actions_fund.png': {
    module: require('@/assets/images/card_actions_fund.png'),
    hash: 'c5ddf5d0',
  },
  'images/card_benefits_one.png': {
    module: require('@/assets/images/card_benefits_one.png'),
    hash: '5f7e7dc7',
  },
  'images/card_benefits_three.png': {
    module: require('@/assets/images/card_benefits_three.png'),
    hash: '5b399913',
  },
  'images/card_benefits_two.png': {
    module: require('@/assets/images/card_benefits_two.png'),
    hash: '6d6277b2',
  },
  'images/card_details.png': {
    module: require('@/assets/images/card_details.png'),
    hash: '9c3da4f2',
  },
  'images/card_frozen.png': {
    module: require('@/assets/images/card_frozen.png'),
    hash: '92cfd6f7',
  },
  'images/cards-banner.png': {
    module: require('@/assets/images/cards-banner.png'),
    hash: 'd06e9e0f',
  },
  'images/cards-desktop.png': {
    module: require('@/assets/images/cards-desktop.png'),
    hash: 'ae26473b',
  },
  'images/cards-mobile.png': {
    module: require('@/assets/images/cards-mobile.png'),
    hash: '25299184',
  },
  'images/cards.png': { module: require('@/assets/images/cards.png'), hash: '6c671c63' },
  'images/checkmark.tsx': { module: require('@/assets/images/checkmark.tsx'), hash: '66caebb4' },
  'images/delete-account.tsx': {
    module: require('@/assets/images/delete-account.tsx'),
    hash: 'cda6dcfa',
  },
  'images/deposit-green.png': {
    module: require('@/assets/images/deposit-green.png'),
    hash: '9d913b52',
  },
  'images/deposit-indigo.png': {
    module: require('@/assets/images/deposit-indigo.png'),
    hash: '724d5f13',
  },
  'images/deposit-purple.png': {
    module: require('@/assets/images/deposit-purple.png'),
    hash: '5d2c441b',
  },
  'images/deposit.png': { module: require('@/assets/images/deposit.png'), hash: '69b1f817' },
  'images/deposit.tsx': { module: require('@/assets/images/deposit.tsx'), hash: '69c67c52' },
  'images/deposit_banner.png': {
    module: require('@/assets/images/deposit_banner.png'),
    hash: 'c307b0be',
  },
  'images/deposit_from_external_wallet.png': {
    module: require('@/assets/images/deposit_from_external_wallet.png'),
    hash: '59bd1480',
  },
  'images/deposit_image.png': {
    module: require('@/assets/images/deposit_image.png'),
    hash: '13f39c01',
  },
  'images/diamond.png': { module: require('@/assets/images/diamond.png'), hash: '9875c4f5' },
  'images/diamond.tsx': { module: require('@/assets/images/diamond.tsx'), hash: '6654209f' },
  'images/docs.tsx': { module: require('@/assets/images/docs.tsx'), hash: '458b69fc' },
  'images/dollar-yellow.png': {
    module: require('@/assets/images/dollar-yellow.png'),
    hash: '59cf014d',
  },
  'images/earn-green.png': { module: require('@/assets/images/earn-green.png'), hash: 'a1f2db4d' },
  'images/earn-indigo.png': {
    module: require('@/assets/images/earn-indigo.png'),
    hash: 'd62196f9',
  },
  'images/earn-purple.png': {
    module: require('@/assets/images/earn-purple.png'),
    hash: 'b07c0123',
  },
  'images/earn.png': { module: require('@/assets/images/earn.png'), hash: 'c1d01a5d' },
  'images/email.png': { module: require('@/assets/images/email.png'), hash: '7154e7ce' },
  'images/email.tsx': { module: require('@/assets/images/email.tsx'), hash: '1882cb4f' },
  'images/eth-bitcoin-usdc-4x.png': {
    module: require('@/assets/images/eth-bitcoin-usdc-4x.png'),
    hash: '01661ca4',
  },
  'images/eth-fuse-usdc-4x.png': {
    module: require('@/assets/images/eth-fuse-usdc-4x.png'),
    hash: '395f58b5',
  },
  'images/eth.png': { module: require('@/assets/images/eth.png'), hash: '546f916e' },
  'images/ethereum-square-4x.png': {
    module: require('@/assets/images/ethereum-square-4x.png'),
    hash: '5c6331c8',
  },
  'images/eur-fiat-currency.tsx': {
    module: require('@/assets/images/eur-fiat-currency.tsx'),
    hash: 'db4e5f78',
  },
  'images/exclamation-mark.tsx': {
    module: require('@/assets/images/exclamation-mark.tsx'),
    hash: '0c62ca51',
  },
  'images/exclamation-warning.png': {
    module: require('@/assets/images/exclamation-warning.png'),
    hash: '0e016e69',
  },
  'images/exclamation_mark.png': {
    module: require('@/assets/images/exclamation_mark.png'),
    hash: '962c5177',
  },
  'images/favicon.png': { module: require('@/assets/images/favicon.png'), hash: '7b8f50eb' },
  'images/fingetprint copy.tsx': {
    module: require('@/assets/images/fingetprint copy.tsx'),
    hash: '0b09bf2a',
  },
  'images/fingetprint.tsx': {
    module: require('@/assets/images/fingetprint.tsx'),
    hash: '0b09bf2a',
  },
  'images/freeze_button_icon.png': {
    module: require('@/assets/images/freeze_button_icon.png'),
    hash: 'e4b22d73',
  },
  'images/fund-wallet-tokens.png': {
    module: require('@/assets/images/fund-wallet-tokens.png'),
    hash: 'd7de7d8e',
  },
  'images/fund-your-wallet.tsx': {
    module: require('@/assets/images/fund-your-wallet.tsx'),
    hash: 'aa901680',
  },
  'images/fund_image.png': { module: require('@/assets/images/fund_image.png'), hash: 'dc8b5410' },
  'images/fund_your_wallet_large.png': {
    module: require('@/assets/images/fund_your_wallet_large.png'),
    hash: 'b9c67a49',
  },
  'images/fuse-4x.png': { module: require('@/assets/images/fuse-4x.png'), hash: '280845e7' },
  'images/fuse.png': { module: require('@/assets/images/fuse.png'), hash: '573a1a32' },
  'images/google_pay.png': { module: require('@/assets/images/google_pay.png'), hash: '78c91f8f' },
  'images/grant_notifications.png': {
    module: require('@/assets/images/grant_notifications.png'),
    hash: 'f6a1d711',
  },
  'images/gray_onboarding_bg.png': {
    module: require('@/assets/images/gray_onboarding_bg.png'),
    hash: 'b4c20e0b',
  },
  'images/green-diamond.png': {
    module: require('@/assets/images/green-diamond.png'),
    hash: '1132ebfd',
  },
  'images/green_onboarding_bg.png': {
    module: require('@/assets/images/green_onboarding_bg.png'),
    hash: 'c358e28f',
  },
  'images/home-card.tsx': { module: require('@/assets/images/home-card.tsx'), hash: '08bd1dde' },
  'images/home-fund.tsx': { module: require('@/assets/images/home-fund.tsx'), hash: 'b5101922' },
  'images/home-qr.tsx': { module: require('@/assets/images/home-qr.tsx'), hash: '0c89afeb' },
  'images/home-send.tsx': { module: require('@/assets/images/home-send.tsx'), hash: '7a61497d' },
  'images/home-swap.tsx': { module: require('@/assets/images/home-swap.tsx'), hash: '5ea4a65b' },
  'images/info-error.tsx': { module: require('@/assets/images/info-error.tsx'), hash: '75c1c092' },
  'images/ipor-fusion.png': {
    module: require('@/assets/images/ipor-fusion.png'),
    hash: '5605920f',
  },
  'images/key-muted.png': { module: require('@/assets/images/key-muted.png'), hash: '041c4fd4' },
  'images/key.png': { module: require('@/assets/images/key.png'), hash: '2a016399' },
  'images/key.tsx': { module: require('@/assets/images/key.tsx'), hash: 'de44f15d' },
  'images/kyc_under_review.png': {
    module: require('@/assets/images/kyc_under_review.png'),
    hash: '9f6bccd4',
  },
  'images/legal.tsx': { module: require('@/assets/images/legal.tsx'), hash: 'c5189cad' },
  'images/lifebuoy.tsx': { module: require('@/assets/images/lifebuoy.tsx'), hash: 'bd7fd8cc' },
  'images/login_key_icon.tsx': {
    module: require('@/assets/images/login_key_icon.tsx'),
    hash: 'e5bb391a',
  },
  'images/logout.tsx': { module: require('@/assets/images/logout.tsx'), hash: 'd540e375' },
  'images/merkl.png': { module: require('@/assets/images/merkl.png'), hash: 'c4c14095' },
  'images/messages.tsx': { module: require('@/assets/images/messages.tsx'), hash: '37cbc1f8' },
  'images/metamask.tsx': { module: require('@/assets/images/metamask.tsx'), hash: '32683a7e' },
  'images/morpho.png': { module: require('@/assets/images/morpho.png'), hash: 'c159616d' },
  'images/mxn-fiat-currency.tsx': {
    module: require('@/assets/images/mxn-fiat-currency.tsx'),
    hash: 'aa8e75e4',
  },
  'images/no_funds_deposit_icon.png': {
    module: require('@/assets/images/no_funds_deposit_icon.png'),
    hash: '69b1f817',
  },
  'images/no_funds_earn_icon.png': {
    module: require('@/assets/images/no_funds_earn_icon.png'),
    hash: 'c1d01a5d',
  },
  'images/no_funds_withdraw_icon.png': {
    module: require('@/assets/images/no_funds_withdraw_icon.png'),
    hash: '972fd805',
  },
  'images/onboarding_solid.png': {
    module: require('@/assets/images/onboarding_solid.png'),
    hash: '31c6f95b',
  },
  'images/one-percent-cashback.png': {
    module: require('@/assets/images/one-percent-cashback.png'),
    hash: 'e3f22ad7',
  },
  'images/overview-reallocation.png': {
    module: require('@/assets/images/overview-reallocation.png'),
    hash: '1fe69541',
  },
  'images/overview-risk-adjusted.png': {
    module: require('@/assets/images/overview-risk-adjusted.png'),
    hash: '659fdb7d',
  },
  'images/overview-withdraw.png': {
    module: require('@/assets/images/overview-withdraw.png'),
    hash: '1f8ed8ac',
  },
  'images/passkey-svg.tsx': {
    module: require('@/assets/images/passkey-svg.tsx'),
    hash: '63ee97b3',
  },
  'images/pendle.png': { module: require('@/assets/images/pendle.png'), hash: 'aceaea5e' },
  'images/person-key.tsx': { module: require('@/assets/images/person-key.tsx'), hash: '832d595f' },
  'images/points-star.png': {
    module: require('@/assets/images/points-star.png'),
    hash: '89db8759',
  },
  'images/points_large.png': {
    module: require('@/assets/images/points_large.png'),
    hash: 'ffc02ca9',
  },
  'images/polygon.png': { module: require('@/assets/images/polygon.png'), hash: 'ba45be44' },
  'images/process.tsx': { module: require('@/assets/images/process.tsx'), hash: '64facfee' },
  'images/profile.tsx': { module: require('@/assets/images/profile.tsx'), hash: 'd9b450e5' },
  'images/public_address.png': {
    module: require('@/assets/images/public_address.png'),
    hash: '039e2815',
  },
  'images/purple_onboarding_bg.png': {
    module: require('@/assets/images/purple_onboarding_bg.png'),
    hash: 'd1e4a1fb',
  },
  'images/question-mark-gray.png': {
    module: require('@/assets/images/question-mark-gray.png'),
    hash: '327f0025',
  },
  'images/question-mark.png': {
    module: require('@/assets/images/question-mark.png'),
    hash: '958654b9',
  },
  'images/question.tsx': { module: require('@/assets/images/question.tsx'), hash: '8b7173f8' },
  'images/refer_friend.png': {
    module: require('@/assets/images/refer_friend.png'),
    hash: 'b23496a3',
  },
  'images/referral_large.png': {
    module: require('@/assets/images/referral_large.png'),
    hash: '79bcfd00',
  },
  'images/reveal_card_details_icon.png': {
    module: require('@/assets/images/reveal_card_details_icon.png'),
    hash: 'd1c558ce',
  },
  'images/savings-nav-bar-icon.tsx': {
    module: require('@/assets/images/savings-nav-bar-icon.tsx'),
    hash: 'd9241a35',
  },
  'images/savings.tsx': { module: require('@/assets/images/savings.tsx'), hash: '860feed3' },
  'images/security_email.png': {
    module: require('@/assets/images/security_email.png'),
    hash: '7e1661ef',
  },
  'images/security_key.png': {
    module: require('@/assets/images/security_key.png'),
    hash: 'fe2dba08',
  },
  'images/security_totp.png': {
    module: require('@/assets/images/security_totp.png'),
    hash: '175e33f0',
  },
  'images/security_unlock.png': {
    module: require('@/assets/images/security_unlock.png'),
    hash: '3c010e52',
  },
  'images/settings.tsx': { module: require('@/assets/images/settings.tsx'), hash: '52cb1947' },
  'images/settings_account_details.png': {
    module: require('@/assets/images/settings_account_details.png'),
    hash: 'a779bd0d',
  },
  'images/settings_help_and_support.png': {
    module: require('@/assets/images/settings_help_and_support.png'),
    hash: '8f981cfa',
  },
  'images/settings_logout.png': {
    module: require('@/assets/images/settings_logout.png'),
    hash: '58679d21',
  },
  'images/settings_security.png': {
    module: require('@/assets/images/settings_security.png'),
    hash: '80d7dfdf',
  },
  'images/settings_wallet_address.png': {
    module: require('@/assets/images/settings_wallet_address.png'),
    hash: '64a9622e',
  },
  'images/sign-out.tsx': { module: require('@/assets/images/sign-out.tsx'), hash: 'deb2a605' },
  'images/solid-4x.png': { module: require('@/assets/images/solid-4x.png'), hash: 'f6579942' },
  'images/solid-black-large.png': {
    module: require('@/assets/images/solid-black-large.png'),
    hash: '392a9c93',
  },
  'images/solid-dark-purple.png': {
    module: require('@/assets/images/solid-dark-purple.png'),
    hash: 'e599ecfa',
  },
  'images/solid-green.png': {
    module: require('@/assets/images/solid-green.png'),
    hash: 'f7ce6371',
  },
  'images/solid-indigo.png': {
    module: require('@/assets/images/solid-indigo.png'),
    hash: '07538627',
  },
  'images/solid-logo-4x.png': {
    module: require('@/assets/images/solid-logo-4x.png'),
    hash: '593b3eae',
  },
  'images/solid-logo.png': { module: require('@/assets/images/solid-logo.png'), hash: '99ad52f2' },
  'images/solid-open-graph.png': {
    module: require('@/assets/images/solid-open-graph.png'),
    hash: 'a6009c39',
  },
  'images/solid-purple-large.png': {
    module: require('@/assets/images/solid-purple-large.png'),
    hash: 'ff520374',
  },
  'images/solid-wordmark.png': {
    module: require('@/assets/images/solid-wordmark.png'),
    hash: '805abddf',
  },
  'images/solid.png': { module: require('@/assets/images/solid.png'), hash: '333f11d4' },
  'images/solid_logo_with_glare.png': {
    module: require('@/assets/images/solid_logo_with_glare.png'),
    hash: '13207041',
  },
  'images/sousd-4x.png': { module: require('@/assets/images/sousd-4x.png'), hash: 'bf43c3e5' },
  'images/splash-icon.png': {
    module: require('@/assets/images/splash-icon.png'),
    hash: 'efd642e5',
  },
  'images/star-bronze.png': {
    module: require('@/assets/images/star-bronze.png'),
    hash: '14067288',
  },
  'images/star-gold.png': { module: require('@/assets/images/star-gold.png'), hash: 'e96ddea2' },
  'images/star-silver.png': {
    module: require('@/assets/images/star-silver.png'),
    hash: '3c3d13e1',
  },
  'images/star.png': { module: require('@/assets/images/star.png'), hash: 'ed4389a9' },
  'images/support-svg.tsx': {
    module: require('@/assets/images/support-svg.tsx'),
    hash: 'ecd74b24',
  },
  'images/support.tsx': { module: require('@/assets/images/support.tsx'), hash: '1462bd11' },
  'images/swap_circle.png': {
    module: require('@/assets/images/swap_circle.png'),
    hash: '5d84c53c',
  },
  'images/three-percent.png': {
    module: require('@/assets/images/three-percent.png'),
    hash: 'f1e94427',
  },
  'images/usd-fiat-currency.tsx': {
    module: require('@/assets/images/usd-fiat-currency.tsx'),
    hash: '1f4c9b1b',
  },
  'images/usdc-4x.png': { module: require('@/assets/images/usdc-4x.png'), hash: '9fdc47e1' },
  'images/usdc-cryptocurrency.tsx': {
    module: require('@/assets/images/usdc-cryptocurrency.tsx'),
    hash: 'e44f82e6',
  },
  'images/usdc.png': { module: require('@/assets/images/usdc.png'), hash: '46823699' },
  'images/usds.png': { module: require('@/assets/images/usds.png'), hash: 'dbf8e06b' },
  'images/usdt.png': { module: require('@/assets/images/usdt.png'), hash: '1d1a08f2' },
  'images/user.tsx': { module: require('@/assets/images/user.tsx'), hash: 'f4988f53' },
  'images/username.tsx': { module: require('@/assets/images/username.tsx'), hash: 'fa07b216' },
  'images/veda.png': { module: require('@/assets/images/veda.png'), hash: 'e41bfe57' },
  'images/wallet.tsx': { module: require('@/assets/images/wallet.tsx'), hash: '64b9ce19' },
  'images/wallet_connect.png': {
    module: require('@/assets/images/wallet_connect.png'),
    hash: '7816178c',
  },
  'images/withdraw-green.png': {
    module: require('@/assets/images/withdraw-green.png'),
    hash: 'a034a503',
  },
  'images/withdraw-icon.tsx': {
    module: require('@/assets/images/withdraw-icon.tsx'),
    hash: 'ff956f75',
  },
  'images/withdraw-indigo.png': {
    module: require('@/assets/images/withdraw-indigo.png'),
    hash: '6553a3ca',
  },
  'images/withdraw-purple.png': {
    module: require('@/assets/images/withdraw-purple.png'),
    hash: 'a387764e',
  },
  'images/withdraw.png': { module: require('@/assets/images/withdraw.png'), hash: '972fd805' },
  'images/withdraw.tsx': { module: require('@/assets/images/withdraw.tsx'), hash: '2d99cf78' },
  'images/yellow_onboarding_bg.png': {
    module: require('@/assets/images/yellow_onboarding_bg.png'),
    hash: '6ed53629',
  },
  'splash/splash-icon.png': {
    module: require('@/assets/splash/splash-icon.png'),
    hash: '15315f99',
  },
  // @assets-registry-end
} as const;

export type AssetPath = keyof typeof ASSETS;

/**
 * New simplified helper that uses the registry for type-safe asset loading.
 * Usage: getAsset('images/usdc.png')
 */
export const getAsset = (path: AssetPath) => {
  const asset = ASSETS[path] as any;

  if (!asset) {
    console.error(`Asset not found in registry: ${path}`);
    return null;
  }

  // Only use CDN on Web. Mobile should always use local bundled assets.
  const isWeb = Platform.OS === 'web';
  const shouldUseCDN = isWeb && EXPO_PUBLIC_BASE_URL && !__DEV__;

  if (shouldUseCDN) {
    return { uri: `${EXPO_PUBLIC_BASE_URL}/assets/${path}?v=${asset.hash}` };
  }

  return asset.module;
};

/**
 * Helper to get a direct CDN URL string.
 * Useful for components that require a string URL instead of an asset object.
 */
export const getImageUrl = (path: AssetPath) => {
  const asset = ASSETS[path] as any;
  if (!asset) {
    console.error(`Asset not found in registry: ${path}`);
    return '';
  }

  // Only use CDN on Web.
  const isWeb = Platform.OS === 'web';
  const shouldUseCDN = isWeb && EXPO_PUBLIC_BASE_URL && !__DEV__;

  if (shouldUseCDN) {
    return `${EXPO_PUBLIC_BASE_URL}/assets/${path}?v=${asset.hash}`;
  }

  // If we're on web dev, return the local path from the public folder
  if (isWeb && __DEV__) {
    return `/assets/${path}`;
  }

  return '';
};
