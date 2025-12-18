export interface OnboardingPageData {
  id: string;
  title: string;
  subtitle?: string;
  animation?: any;
  image?: any; // Static image source for pages
  isLastPage?: boolean;
}

// Gradient colors for each slide (start opacity, end opacity)
export const getGradientColors = (index: number): [string, string] => {
  switch (index) {
    case 0: // Purple - rocket
      return ['rgba(122, 84, 234, 0.30)', 'rgba(122, 84, 234, 0.09)'];
    case 1: // Green - cards
      return ['rgba(148, 242, 127, 0.20)', 'rgba(148, 242, 127, 0.03)'];
    case 2: // Yellow/Gold - vault
      return ['rgba(255, 209, 81, 0.30)', 'rgba(255, 209, 81, 0.09)'];
    default:
      return ['rgba(122, 84, 234, 0.30)', 'rgba(122, 84, 234, 0.09)'];
  }
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
    image: require('@/assets/images/card-onboarding.png'),
  },
  {
    id: '3',
    title: 'Your money, made simple',
    subtitle: 'No gas. No seed phrases.\nNo bridging. Non-custodial.',
    animation: require('@/assets/animations/vault.json'),
  },
];
