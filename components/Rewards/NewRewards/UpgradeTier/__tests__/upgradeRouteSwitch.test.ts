import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  ROUTE_LABEL,
  upgradeRouteLabelClass,
} from '@/components/Rewards/NewRewards/UpgradeTier/upgradeRouteLabel';

/** Exactly what `components/ui/text` puts in front of every label's own class. */
const TEXT_BASE = 'text-foreground web:select-text';

/**
 * The class list that actually reaches the element.
 *
 * `twMerge(clsx(…))` is the body of `cn` — inlined rather than imported because
 * `@/lib/utils` reaches the whole wagmi/viem stack and this is a string test.
 */
const resolved = (labelClass: string) => twMerge(clsx([TEXT_BASE, labelClass]));

describe('upgradeRouteLabelClass', () => {
  it('paints the selected label black, for the white pill it sits on', () => {
    expect(resolved(upgradeRouteLabelClass(true))).toContain('text-black');
  });

  it('paints the unselected label white, for the dark track it sits on', () => {
    expect(resolved(upgradeRouteLabelClass(false))).toContain('text-white');
  });

  /**
   * The bug, three times over.
   *
   * `text-foreground` is white and `ui/text` prepends it to every label. It
   * survives the merge unless the label brings a colour of its own — and it
   * beats a colour set through the `style` prop on web, because
   * react-native-web inserts its stylesheet as `head.firstChild`, below the
   * Tailwind sheet. A selected label that leaves it standing is white on white.
   */
  it('leaves no inherited white for the selected label to lose to', () => {
    expect(resolved(upgradeRouteLabelClass(true))).not.toContain('text-foreground');
  });

  it('is what a style-only label could not do — the shape that shipped white', () => {
    expect(resolved('text-[16px] leading-5 font-semibold')).toContain('text-foreground');
  });
});

describe('ROUTE_LABEL', () => {
  /** The lock takes soFUSE shares from Savings, never native FUSE. */
  it('names the token the lock actually takes', () => {
    expect(ROUTE_LABEL.lock).toBe('Locked soFUSE');
  });
});
