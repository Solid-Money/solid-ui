export interface SpendModeHelpSlide {
  key: 'twoWays' | 'keepEarning' | 'repayAnytime';
  badge?: string;
  title: string;
  description: string;
  cta: 'Next' | 'Got it';
}

/** Copy from the three Credit help frames in Figma. */
export const SPEND_MODE_HELP_SLIDES: SpendModeHelpSlide[] = [
  {
    key: 'twoWays',
    badge: 'Introducing - Credit mode',
    title: 'Two ways to pay',
    description:
      'Cash pays from your USD balance. Credit lets you spend without selling your assets.',
    cta: 'Next',
  },
  {
    key: 'keepEarning',
    title: 'Keep earning',
    description:
      'With Credit, your assets stay invested and keep earning yield. You still earn cashback too.',
    cta: 'Next',
  },
  {
    key: 'repayAnytime',
    title: 'Repay anytime',
    description: 'No fixed payments or penalties. See what you owe and repay whenever you want.',
    cta: 'Got it',
  },
];
