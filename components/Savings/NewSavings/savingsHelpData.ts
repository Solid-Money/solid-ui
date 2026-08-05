import { SavingsHelpGlowColor } from './SavingsHelpGlow';

export interface SavingsHelpSlide {
  key: string;
  glowColor: SavingsHelpGlowColor;
  title: string;
  description: string;
  cta: string;
}

// "How savings works" carousel — Figma 20609-4854, 20609-4946, 20609-4989.
export const SAVINGS_HELP_SLIDES: SavingsHelpSlide[] = [
  {
    key: 'deposit',
    glowColor: 'purple',
    title: 'Deposit & earn',
    description:
      'Deposit USDC, ETH, or FUSE into Savings and start earning at the current rate right away.',
    cta: 'Next',
  },
  {
    key: 'grow',
    glowColor: 'purple',
    title: 'Watch it grow',
    description:
      'Earnings are added to your Savings balance automatically and compound over time. Nothing to manage.',
    cta: 'Next',
  },
  {
    key: 'withdraw',
    glowColor: 'purple',
    title: 'Withdraw anytime',
    description:
      'Move your available savings back to your wallet or straight to your card whenever you need them.',
    cta: 'Got it',
  },
];
