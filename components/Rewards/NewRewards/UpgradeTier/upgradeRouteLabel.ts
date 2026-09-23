import type { TierUpgradeRoute } from '@/lib/tierUpgrade';

/** What each payment route is called on the switch. */
export const ROUTE_LABEL: Record<TierUpgradeRoute, string> = {
  cash: 'Cash',
  // soFUSE, not FUSE: what gets locked is the Savings position, and a tab that
  // says "FUSE" sends people looking for native FUSE in their wallet.
  lock: 'Locked soFUSE',
};

/**
 * The colour class for a segment label — its own module because this one class
 * is the whole bug the switch has now been fixed for three times, and because a
 * test for it should not have to mount a component to read it.
 *
 * `ui/text` renders `cn('text-foreground web:select-text', …, className, …)`,
 * and `text-foreground` is white. tailwind-merge drops it only when the label
 * brings a text colour of its own, so a label styled purely through `style`
 * leaves the class list as literally `text-foreground web:select-text`. On web
 * that class then wins outright, because react-native-web inserts its own
 * stylesheet as `head.firstChild` — below the Tailwind sheet — so a Tailwind
 * colour beats the atomic class generated from the `style` prop. Black on white
 * came out white on white: an empty pill.
 *
 * The colour is therefore declared in both layers, saying the same thing.
 * Whichever one the platform resolves last, the label is legible.
 */
export const upgradeRouteLabelClass = (isSelected: boolean) =>
  isSelected ? 'text-black' : 'text-white';
