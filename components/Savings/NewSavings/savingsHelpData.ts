import { AssetPath } from '@/lib/assets';

import { SavingsHelpGlowColor } from './SavingsHelpGlow';

export interface SavingsHelpSlide {
  key: string;
  hero: AssetPath;
  glowColor: SavingsHelpGlowColor;
  title: string;
  description: string;
  cta: string;
}

// "How savings works" carousel — Figma 20226-461, 20232-461, 20232-462.
export const SAVINGS_HELP_SLIDES: SavingsHelpSlide[] = [
  {
    key: 'deposit',
    hero: 'images/savings-help-deposit.png',
    glowColor: 'purple',
    title: 'Deposit USDC',
    description: 'Move USDC into Savings. Once it lands, it begins earning at the current rate.',
    cta: 'Next',
  },
  {
    key: 'grow',
    hero: 'images/savings-help-grow.png',
    glowColor: 'green',
    title: 'Watch it grow',
    description: 'Interest is added automatically to your Savings balance—nothing else to manage.',
    cta: 'Next',
  },
  {
    key: 'withdraw',
    hero: 'images/savings-help-withdraw.png',
    glowColor: 'purple',
    title: 'Withdraw anytime',
    description: 'Move available savings back to your wallet whenever you need it.',
    cta: 'Got it',
  },
];
