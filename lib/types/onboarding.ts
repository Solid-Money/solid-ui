import { Platform } from "react-native";

export interface OnboardingImage {
  source: any;
  width: number;
  height: number;
}

export interface OnboardingPageData {
  id: string;
  title: string;
  subtitle?: string;
  animation?: any;
  isLastPage?: boolean;
  image?: OnboardingImage;
  platform?: boolean;
}

// Gradient colors for each slide (start opacity, end opacity)
export const GRADIENT_COLORS: [string, string][] = [
  ['rgba(122, 84, 234, 0.30)', 'rgba(122, 84, 234, 0.09)'], // Purple - rocket
  ['rgba(148, 242, 127, 0.20)', 'rgba(148, 242, 127, 0.03)'], // Green - cards
  ['rgba(255, 209, 81, 0.30)', 'rgba(255, 209, 81, 0.09)'], // Yellow/Gold - vault
  ['rgba(28, 28, 28, 1)', 'rgba(28, 28, 28, 1)'], // Black - app
];

export const getGradientColors = (index: number): [string, string] => {
  return GRADIENT_COLORS[index] ?? GRADIENT_COLORS[0];
};

// Background images for each slide
export const getBackgroundImage = (index: number) => {
  switch (index) {
    case 0:
      return require('@/assets/images/purple_onboarding_bg.png');
    case 1:
      return require('@/assets/images/green_onboarding_bg.png');
    case 2:
      return require('@/assets/images/yellow_onboarding_bg.png');
    case 3:
      return require('@/assets/images/gray_onboarding_bg.png');
    default:
      return null;
  }
};

export const ONBOARDING_DATA: OnboardingPageData[] = [
  {
    id: '1',
    title: 'Grow your savings',
    subtitle: 'Earn 10%+ yield on\nyour stablecoins',
    animation: require('@/assets/animations/rocket.json'),
  },
  {
    id: '2',
    title: 'Spend while you earn',
    subtitle: 'Your funds instantly spendable at over 200M merchants worldwide',
    animation: require('@/assets/animations/card.json'),
  },
  {
    id: '3',
    title: 'Your money, made simple',
    subtitle: 'No gas. No seed phrases.\nNo bridging. Non-custodial.',
    animation: require('@/assets/animations/vault.json'),
  },
  {
    id: '4',
    title: 'Your Stablecoin Super-app',
    subtitle: 'Earn more then your bank &\nspend stables everywhere\nwith a Visa Card',
    image: {
      source: require('@/assets/images/solid-wordmark.png'),
      width: 213,
      height: 63,
    },
    platform: Platform.OS !== 'web',
  },
];
