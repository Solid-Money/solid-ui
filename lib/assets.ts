/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';
import { EXPO_PUBLIC_BASE_URL } from './config';

/**
 * Registry of all local assets.
 */
export const ASSETS = {
  // @assets-registry-start
  'animations/card.json': { module: require('@/assets/animations/card.json'), hash: '2d44b7b1' },
  'animations/lightning.json': {
    module: require('@/assets/animations/lightning.json'),
    hash: 'a0fb7114',
  },
  'animations/rocket.json': {
    module: require('@/assets/animations/rocket.json'),
    hash: '8d519fad',
  },
  'animations/vault.json': { module: require('@/assets/animations/vault.json'), hash: 'd9c7388a' },
  'fonts/SpaceMono-Regular.ttf': {
    module: require('@/assets/fonts/SpaceMono-Regular.ttf'),
    hash: '49a79d66',
  },
  'images/Plus.tsx': { module: require('@/assets/images/Plus.tsx'), hash: '55abc084' },
  'images/activate_card.png': {
    module: require('@/assets/images/activate_card.png'),
    hash: '260e9cbf',
  },
  'images/activate_card_desktop.png': {
    module: require('@/assets/images/activate_card_desktop.png'),
    hash: '9d8ff6a0',
  },
  'images/activate_card_steps.png': {
    module: require('@/assets/images/activate_card_steps.png'),
    hash: '2f47598d',
  },
  'images/activity-nav-bar-icon.tsx': {
    module: require('@/assets/images/activity-nav-bar-icon.tsx'),
    hash: 'e3a67550',
  },
  'images/adaptive-icon.png': {
    module: require('@/assets/images/adaptive-icon.png'),
    hash: '080568eb',
  },
  'images/apple-google-pay.png': {
    module: require('@/assets/images/apple-google-pay.png'),
    hash: '76798d37',
  },
  'images/apple_pay.png': { module: require('@/assets/images/apple_pay.png'), hash: '3062650e' },
  'images/arbitrum.png': { module: require('@/assets/images/arbitrum.png'), hash: 'c1ae946a' },
  'images/assets-nav-bar-icon.tsx': {
    module: require('@/assets/images/assets-nav-bar-icon.tsx'),
    hash: '08b0fc9f',
  },
  'images/auto-finance.jpg': {
    module: require('@/assets/images/auto-finance.jpg'),
    hash: '10c73282',
  },
  'images/avantis.png': { module: require('@/assets/images/avantis.png'), hash: 'd2f09541' },
  'images/backspace.png': { module: require('@/assets/images/backspace.png'), hash: '82720936' },
  'images/bank_deposit.png': {
    module: require('@/assets/images/bank_deposit.png'),
    hash: 'c968420b',
  },
  'images/base.png': { module: require('@/assets/images/base.png'), hash: '9e3dafef' },
  'images/bitcoin-usdc-4x.png': {
    module: require('@/assets/images/bitcoin-usdc-4x.png'),
    hash: '54556262',
  },
  'images/brl-fiat-currency.tsx': {
    module: require('@/assets/images/brl-fiat-currency.tsx'),
    hash: '0f783301',
  },
  'images/buy_crypto.png': { module: require('@/assets/images/buy_crypto.png'), hash: 'b5d295a5' },
  'images/card-earn.png': { module: require('@/assets/images/card-earn.png'), hash: '1bcb4ed8' },
  'images/card-effortless.png': {
    module: require('@/assets/images/card-effortless.png'),
    hash: '3f457c59',
  },
  'images/card-global.png': {
    module: require('@/assets/images/card-global.png'),
    hash: '708cdfb0',
  },
  'images/card-nav-bar-icon.tsx': {
    module: require('@/assets/images/card-nav-bar-icon.tsx'),
    hash: '5ccff6eb',
  },
  'images/card-onboarding.png': {
    module: require('@/assets/images/card-onboarding.png'),
    hash: 'f7fc47cc',
  },
  'images/card-safe.png': { module: require('@/assets/images/card-safe.png'), hash: 'a956c248' },
  'images/card.tsx': { module: require('@/assets/images/card.tsx'), hash: '56842525' },
  'images/card_actions_details.png': {
    module: require('@/assets/images/card_actions_details.png'),
    hash: '5fdcbab8',
  },
  'images/card_actions_freeze.png': {
    module: require('@/assets/images/card_actions_freeze.png'),
    hash: '39e1d9a3',
  },
  'images/card_actions_fund.png': {
    module: require('@/assets/images/card_actions_fund.png'),
    hash: '55e41cf6',
  },
  'images/card_benefits_one.png': {
    module: require('@/assets/images/card_benefits_one.png'),
    hash: '2f5a85fd',
  },
  'images/card_benefits_three.png': {
    module: require('@/assets/images/card_benefits_three.png'),
    hash: 'cc1fc35e',
  },
  'images/card_benefits_two.png': {
    module: require('@/assets/images/card_benefits_two.png'),
    hash: '4c74e8e1',
  },
  'images/card_details.png': {
    module: require('@/assets/images/card_details.png'),
    hash: '9e37e2a5',
  },
  'images/card_frozen.png': {
    module: require('@/assets/images/card_frozen.png'),
    hash: 'b44ad7bd',
  },
  'images/cards-banner.png': {
    module: require('@/assets/images/cards-banner.png'),
    hash: '01406cc0',
  },
  'images/cards-desktop.png': {
    module: require('@/assets/images/cards-desktop.png'),
    hash: 'c7abbbae',
  },
  'images/cards-mobile.png': {
    module: require('@/assets/images/cards-mobile.png'),
    hash: 'b6e37209',
  },
  'images/cards.png': { module: require('@/assets/images/cards.png'), hash: 'c780b4f9' },
  'images/checkmark.tsx': { module: require('@/assets/images/checkmark.tsx'), hash: 'b27dae04' },
  'images/delete-account.tsx': {
    module: require('@/assets/images/delete-account.tsx'),
    hash: '34bb8594',
  },
  'images/deposit-green.png': {
    module: require('@/assets/images/deposit-green.png'),
    hash: '0a27f866',
  },
  'images/deposit-purple.png': {
    module: require('@/assets/images/deposit-purple.png'),
    hash: 'ff3a4ea0',
  },
  'images/deposit.png': { module: require('@/assets/images/deposit.png'), hash: '5173e26a' },
  'images/deposit.tsx': { module: require('@/assets/images/deposit.tsx'), hash: '367f67a7' },
  'images/deposit_banner.png': {
    module: require('@/assets/images/deposit_banner.png'),
    hash: '042b1c65',
  },
  'images/deposit_from_external_wallet.png': {
    module: require('@/assets/images/deposit_from_external_wallet.png'),
    hash: 'f5ba8c17',
  },
  'images/deposit_image.png': {
    module: require('@/assets/images/deposit_image.png'),
    hash: 'f7de0b4d',
  },
  'images/diamond.png': { module: require('@/assets/images/diamond.png'), hash: 'db2759eb' },
  'images/diamond.tsx': { module: require('@/assets/images/diamond.tsx'), hash: 'fdbe14d6' },
  'images/docs.tsx': { module: require('@/assets/images/docs.tsx'), hash: 'dbe998ce' },
  'images/dollar-yellow.png': {
    module: require('@/assets/images/dollar-yellow.png'),
    hash: 'd86af7b8',
  },
  'images/earn-green.png': { module: require('@/assets/images/earn-green.png'), hash: '015744e2' },
  'images/earn-purple.png': {
    module: require('@/assets/images/earn-purple.png'),
    hash: 'd4e2c65b',
  },
  'images/earn.png': { module: require('@/assets/images/earn.png'), hash: '9d2013b3' },
  'images/email.png': { module: require('@/assets/images/email.png'), hash: '84d862bb' },
  'images/email.tsx': { module: require('@/assets/images/email.tsx'), hash: '1ebbb5f9' },
  'images/eth-bitcoin-usdc-4x.png': {
    module: require('@/assets/images/eth-bitcoin-usdc-4x.png'),
    hash: '535c6825',
  },
  'images/eth-fuse-usdc-4x.png': {
    module: require('@/assets/images/eth-fuse-usdc-4x.png'),
    hash: 'bd34b0e1',
  },
  'images/eth.png': { module: require('@/assets/images/eth.png'), hash: '31fe916d' },
  'images/ethereum-square-4x.png': {
    module: require('@/assets/images/ethereum-square-4x.png'),
    hash: '207c51be',
  },
  'images/eur-fiat-currency.tsx': {
    module: require('@/assets/images/eur-fiat-currency.tsx'),
    hash: 'cd370c02',
  },
  'images/exclamation-mark.tsx': {
    module: require('@/assets/images/exclamation-mark.tsx'),
    hash: '24389713',
  },
  'images/exclamation-warning.png': {
    module: require('@/assets/images/exclamation-warning.png'),
    hash: '0a2a993c',
  },
  'images/exclamation_mark.png': {
    module: require('@/assets/images/exclamation_mark.png'),
    hash: '301f43bd',
  },
  'images/favicon.png': { module: require('@/assets/images/favicon.png'), hash: 'aee677d0' },
  'images/fingetprint copy.tsx': {
    module: require('@/assets/images/fingetprint copy.tsx'),
    hash: '19ed7e7a',
  },
  'images/fingetprint.tsx': {
    module: require('@/assets/images/fingetprint.tsx'),
    hash: '19ed7e7a',
  },
  'images/freeze_button_icon.png': {
    module: require('@/assets/images/freeze_button_icon.png'),
    hash: 'd62b6595',
  },
  'images/fund-wallet-tokens.png': {
    module: require('@/assets/images/fund-wallet-tokens.png'),
    hash: '0ce8e2a9',
  },
  'images/fund-your-wallet.tsx': {
    module: require('@/assets/images/fund-your-wallet.tsx'),
    hash: '83b0302b',
  },
  'images/fund_image.png': { module: require('@/assets/images/fund_image.png'), hash: '0da8313b' },
  'images/fund_your_wallet_large.png': {
    module: require('@/assets/images/fund_your_wallet_large.png'),
    hash: '8adcbbc6',
  },
  'images/fuse-4x.png': { module: require('@/assets/images/fuse-4x.png'), hash: '4cef3457' },
  'images/fuse.png': { module: require('@/assets/images/fuse.png'), hash: 'a70ec580' },
  'images/google_pay.png': { module: require('@/assets/images/google_pay.png'), hash: 'c4d48b07' },
  'images/grant_notifications.png': {
    module: require('@/assets/images/grant_notifications.png'),
    hash: '6592ae72',
  },
  'images/green-diamond.png': {
    module: require('@/assets/images/green-diamond.png'),
    hash: '21505208',
  },
  'images/green_onboarding_bg.png': {
    module: require('@/assets/images/green_onboarding_bg.png'),
    hash: '3cdd00f1',
  },
  'images/home-card.tsx': { module: require('@/assets/images/home-card.tsx'), hash: '99fb3c15' },
  'images/home-fund.tsx': { module: require('@/assets/images/home-fund.tsx'), hash: 'e2682744' },
  'images/home-qr.tsx': { module: require('@/assets/images/home-qr.tsx'), hash: 'de91fbbd' },
  'images/home-send.tsx': { module: require('@/assets/images/home-send.tsx'), hash: '962771b8' },
  'images/home-swap.tsx': { module: require('@/assets/images/home-swap.tsx'), hash: 'c5594dc5' },
  'images/info-error.tsx': { module: require('@/assets/images/info-error.tsx'), hash: '0b5386d6' },
  'images/ipor-fusion.png': {
    module: require('@/assets/images/ipor-fusion.png'),
    hash: '0a9f0548',
  },
  'images/key.tsx': { module: require('@/assets/images/key.tsx'), hash: '5019a6c3' },
  'images/kyc_under_review.png': {
    module: require('@/assets/images/kyc_under_review.png'),
    hash: '45d81fcc',
  },
  'images/legal.tsx': { module: require('@/assets/images/legal.tsx'), hash: '357defb7' },
  'images/lifebuoy.tsx': { module: require('@/assets/images/lifebuoy.tsx'), hash: '1c1d34cb' },
  'images/login_key_icon.tsx': {
    module: require('@/assets/images/login_key_icon.tsx'),
    hash: 'e067b45a',
  },
  'images/logout.tsx': { module: require('@/assets/images/logout.tsx'), hash: 'd3eac244' },
  'images/merkl.png': { module: require('@/assets/images/merkl.png'), hash: 'c50a2817' },
  'images/messages.tsx': { module: require('@/assets/images/messages.tsx'), hash: '8e711bf6' },
  'images/metamask.tsx': { module: require('@/assets/images/metamask.tsx'), hash: '9aeb60ad' },
  'images/morpho.png': { module: require('@/assets/images/morpho.png'), hash: '6c2f1d4a' },
  'images/mxn-fiat-currency.tsx': {
    module: require('@/assets/images/mxn-fiat-currency.tsx'),
    hash: '1b6a81aa',
  },
  'images/no_funds_deposit_icon.png': {
    module: require('@/assets/images/no_funds_deposit_icon.png'),
    hash: '5173e26a',
  },
  'images/no_funds_earn_icon.png': {
    module: require('@/assets/images/no_funds_earn_icon.png'),
    hash: '9d2013b3',
  },
  'images/no_funds_withdraw_icon.png': {
    module: require('@/assets/images/no_funds_withdraw_icon.png'),
    hash: '5c6f562f',
  },
  'images/onboarding_solid.png': {
    module: require('@/assets/images/onboarding_solid.png'),
    hash: '00bb3604',
  },
  'images/one-percent-cashback.png': {
    module: require('@/assets/images/one-percent-cashback.png'),
    hash: '9eac5aea',
  },
  'images/overview-reallocation.png': {
    module: require('@/assets/images/overview-reallocation.png'),
    hash: '66642e71',
  },
  'images/overview-risk-adjusted.png': {
    module: require('@/assets/images/overview-risk-adjusted.png'),
    hash: '3d535491',
  },
  'images/overview-withdraw.png': {
    module: require('@/assets/images/overview-withdraw.png'),
    hash: 'a7409d5c',
  },
  'images/passkey-svg.tsx': {
    module: require('@/assets/images/passkey-svg.tsx'),
    hash: 'd32b5d0e',
  },
  'images/pendle.png': { module: require('@/assets/images/pendle.png'), hash: 'b625b670' },
  'images/person-key.tsx': { module: require('@/assets/images/person-key.tsx'), hash: '03e44324' },
  'images/points-star.png': {
    module: require('@/assets/images/points-star.png'),
    hash: 'fbb8f6e6',
  },
  'images/points_large.png': {
    module: require('@/assets/images/points_large.png'),
    hash: 'eb12e25f',
  },
  'images/polygon.png': { module: require('@/assets/images/polygon.png'), hash: '30f207fb' },
  'images/process.tsx': { module: require('@/assets/images/process.tsx'), hash: 'ff4cf3a3' },
  'images/profile.tsx': { module: require('@/assets/images/profile.tsx'), hash: '68ca1113' },
  'images/public_address.png': {
    module: require('@/assets/images/public_address.png'),
    hash: 'bc7e65d7',
  },
  'images/purple_onboarding_bg.png': {
    module: require('@/assets/images/purple_onboarding_bg.png'),
    hash: '7ae45db9',
  },
  'images/question-mark-gray.png': {
    module: require('@/assets/images/question-mark-gray.png'),
    hash: '5e2287a8',
  },
  'images/question-mark.png': {
    module: require('@/assets/images/question-mark.png'),
    hash: '5c04489e',
  },
  'images/question.tsx': { module: require('@/assets/images/question.tsx'), hash: '8979535f' },
  'images/refer_friend.png': {
    module: require('@/assets/images/refer_friend.png'),
    hash: '894a8782',
  },
  'images/referral_large.png': {
    module: require('@/assets/images/referral_large.png'),
    hash: 'c3948eba',
  },
  'images/reveal_card_details_icon.png': {
    module: require('@/assets/images/reveal_card_details_icon.png'),
    hash: '8e0a97f6',
  },
  'images/savings-nav-bar-icon.tsx': {
    module: require('@/assets/images/savings-nav-bar-icon.tsx'),
    hash: 'b76e646f',
  },
  'images/savings.tsx': { module: require('@/assets/images/savings.tsx'), hash: '19277e1c' },
  'images/security_email.png': {
    module: require('@/assets/images/security_email.png'),
    hash: '3fa4ccfc',
  },
  'images/security_key.png': {
    module: require('@/assets/images/security_key.png'),
    hash: 'b5ae2bd6',
  },
  'images/security_totp.png': {
    module: require('@/assets/images/security_totp.png'),
    hash: '9943a159',
  },
  'images/security_unlock.png': {
    module: require('@/assets/images/security_unlock.png'),
    hash: 'f019f6ac',
  },
  'images/settings.tsx': { module: require('@/assets/images/settings.tsx'), hash: '5085fddb' },
  'images/settings_account_details.png': {
    module: require('@/assets/images/settings_account_details.png'),
    hash: 'a28be095',
  },
  'images/settings_help_and_support.png': {
    module: require('@/assets/images/settings_help_and_support.png'),
    hash: '3d797642',
  },
  'images/settings_logout.png': {
    module: require('@/assets/images/settings_logout.png'),
    hash: '45f5fd35',
  },
  'images/settings_security.png': {
    module: require('@/assets/images/settings_security.png'),
    hash: '27a5b2fe',
  },
  'images/settings_wallet_address.png': {
    module: require('@/assets/images/settings_wallet_address.png'),
    hash: 'c91361a5',
  },
  'images/sign-out.tsx': { module: require('@/assets/images/sign-out.tsx'), hash: '6fcbd90f' },
  'images/solid-4x.png': { module: require('@/assets/images/solid-4x.png'), hash: '03e4adf7' },
  'images/solid-black-large.png': {
    module: require('@/assets/images/solid-black-large.png'),
    hash: '9b984432',
  },
  'images/solid-dark-purple.png': {
    module: require('@/assets/images/solid-dark-purple.png'),
    hash: 'cf493322',
  },
  'images/solid-green.png': {
    module: require('@/assets/images/solid-green.png'),
    hash: '8f22b3d9',
  },
  'images/solid-indigo.png': {
    module: require('@/assets/images/solid-indigo.png'),
    hash: 'dede843a',
  },
  'images/solid-logo-4x.png': {
    module: require('@/assets/images/solid-logo-4x.png'),
    hash: '8b428e7f',
  },
  'images/solid-logo.png': { module: require('@/assets/images/solid-logo.png'), hash: '0585c32c' },
  'images/solid-purple-large.png': {
    module: require('@/assets/images/solid-purple-large.png'),
    hash: '3479c65c',
  },
  'images/solid.png': { module: require('@/assets/images/solid.png'), hash: 'd32b0324' },
  'images/solid_logo_with_glare.png': {
    module: require('@/assets/images/solid_logo_with_glare.png'),
    hash: '4ab9f84d',
  },
  'images/sousd-4x.png': { module: require('@/assets/images/sousd-4x.png'), hash: '220f7b59' },
  'images/splash-icon.png': {
    module: require('@/assets/images/splash-icon.png'),
    hash: 'ea8c6afa',
  },
  'images/star-bronze.png': {
    module: require('@/assets/images/star-bronze.png'),
    hash: '094140d7',
  },
  'images/star-gold.png': { module: require('@/assets/images/star-gold.png'), hash: '921c7d18' },
  'images/star-silver.png': {
    module: require('@/assets/images/star-silver.png'),
    hash: 'd6ac3141',
  },
  'images/star.png': { module: require('@/assets/images/star.png'), hash: '874117dd' },
  'images/support-svg.tsx': {
    module: require('@/assets/images/support-svg.tsx'),
    hash: '5ec51a5e',
  },
  'images/support.tsx': { module: require('@/assets/images/support.tsx'), hash: '7f977bbc' },
  'images/swap_circle.png': {
    module: require('@/assets/images/swap_circle.png'),
    hash: '381e7529',
  },
  'images/three-percent.png': {
    module: require('@/assets/images/three-percent.png'),
    hash: '5251d103',
  },
  'images/usd-fiat-currency.tsx': {
    module: require('@/assets/images/usd-fiat-currency.tsx'),
    hash: '0f6d5d5c',
  },
  'images/usdc-4x.png': { module: require('@/assets/images/usdc-4x.png'), hash: '9a8cb22d' },
  'images/usdc-cryptocurrency.tsx': {
    module: require('@/assets/images/usdc-cryptocurrency.tsx'),
    hash: '5e34af8a',
  },
  'images/usdc.png': { module: require('@/assets/images/usdc.png'), hash: 'c6015a83' },
  'images/usds.png': { module: require('@/assets/images/usds.png'), hash: 'be4f58ea' },
  'images/usdt.png': { module: require('@/assets/images/usdt.png'), hash: 'b4b0b8bb' },
  'images/user.tsx': { module: require('@/assets/images/user.tsx'), hash: '4b74e011' },
  'images/username.tsx': { module: require('@/assets/images/username.tsx'), hash: 'fcf46944' },
  'images/veda.png': { module: require('@/assets/images/veda.png'), hash: 'e9fdbd66' },
  'images/wallet.tsx': { module: require('@/assets/images/wallet.tsx'), hash: '8826fac3' },
  'images/wallet_connect.png': {
    module: require('@/assets/images/wallet_connect.png'),
    hash: '6f99f9eb',
  },
  'images/withdraw-green.png': {
    module: require('@/assets/images/withdraw-green.png'),
    hash: 'e0a9d2a0',
  },
  'images/withdraw-icon.tsx': {
    module: require('@/assets/images/withdraw-icon.tsx'),
    hash: '03f40c4d',
  },
  'images/withdraw-purple.png': {
    module: require('@/assets/images/withdraw-purple.png'),
    hash: '729864da',
  },
  'images/withdraw.png': { module: require('@/assets/images/withdraw.png'), hash: '5c6f562f' },
  'images/withdraw.tsx': { module: require('@/assets/images/withdraw.tsx'), hash: 'c872ea8f' },
  'images/yellow_onboarding_bg.png': {
    module: require('@/assets/images/yellow_onboarding_bg.png'),
    hash: '9cd173ac',
  },
  'splash/splash-icon.png': {
    module: require('@/assets/splash/splash-icon.png'),
    hash: 'c61a05ee',
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
