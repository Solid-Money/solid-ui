export interface OnboardingPageData {
  id: string;
  title: string;
  animation?: any;
  image?: any; // Static image source for last page
  isLastPage?: boolean;
}

export const ONBOARDING_DATA: OnboardingPageData[] = [
  {
    id: '1',
    title: 'Earn 3x the rate of your bank account',
    animation: require('@/assets/animations/rocket.json'),
  },
  {
    id: '2',
    title: 'We cover you with Biometric login & Bank-grade security',
    animation: require('@/assets/animations/vault.json'),
  },
  {
    id: '3',
    title: 'Fast. Free. Simple.',
    animation: require('@/assets/animations/lightning.json'),
  },
  {
    id: '4',
    title: '',
    image: require('@/assets/images/onboarding_solid.png'),
    isLastPage: true,
  },
];
