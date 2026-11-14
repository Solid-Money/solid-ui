export interface RewardsHelpSlide {
  key: string;
  title: string;
  description: string;
  cta: string;
}

// Rewards explainer carousel — Figma 20609-5524, 20609-5615, 21351-689.
export const REWARDS_HELP_SLIDES: RewardsHelpSlide[] = [
  {
    key: 'rewards',
    title: 'Rewards',
    description:
      'Earn cashback when you spend, yield when you save, and rewards when friends you invite spend too.',
    cta: 'Next',
  },
  {
    key: 'tiers',
    title: 'Tiers',
    description:
      'Upgrade by locking FUSE or with an annual membership for higher cashback and better perks.',
    cta: 'Next',
  },
  {
    key: 'perks',
    title: 'Perks',
    description:
      'Get dollars back on AI tools and streaming, plus benefits across travel and insurance.',
    cta: 'Got it',
  },
];
