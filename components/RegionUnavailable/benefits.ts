import { getAsset } from '@/lib/assets';

export interface RegionBenefit {
  icon: ReturnType<typeof getAsset>;
  /** Icon leaf size in pt, straight from the Figma vector's own bounds. */
  iconWidth: number;
  iconHeight: number;
  title: string;
  description: string;
}

/**
 * What the user can still do here — the 2×3 grid shared by both
 * unsupported-region pop-ups (Figma nodes 925:1375 and 925:1529, which carry
 * an identical grid).
 */
export const REGION_BENEFITS: RegionBenefit[] = [
  {
    icon: getAsset('images/region-benefit-deposits.svg'),
    iconWidth: 20,
    iconHeight: 22,
    title: 'Crypto Deposits',
    description: 'Fund wallet and store your crypto securely',
  },
  {
    icon: getAsset('images/region-benefit-yield.svg'),
    iconWidth: 18,
    iconHeight: 21,
    title: 'Earn automatic Yield',
    description: 'Up to 15% APY on USDC, ETH & FUSE',
  },
  {
    icon: getAsset('images/region-benefit-points.svg'),
    iconWidth: 23,
    iconHeight: 23,
    title: 'Points & Rewards',
    description: 'Earn points just for holding funds on Solid',
  },
  {
    icon: getAsset('images/region-benefit-referral.svg'),
    iconWidth: 30,
    iconHeight: 21,
    title: 'Referral Program',
    description: 'Get $15 for every friend you invite',
  },
  {
    icon: getAsset('images/region-benefit-send.svg'),
    iconWidth: 20,
    iconHeight: 19,
    title: 'Send & Receive',
    description: 'Move funds to anyone, anywhere, in seconds',
  },
  {
    icon: getAsset('images/region-benefit-gas.svg'),
    iconWidth: 29,
    iconHeight: 24,
    title: 'No Gas Fees',
    description: 'We cover all in-app transactions',
  },
];
