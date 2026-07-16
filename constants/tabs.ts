/**
 * Bottom-tab visibility configuration.
 *
 * The bottom tab bar is driven by two gates: the `href` on each `Tabs.Screen`
 * in `app/(protected)/(tabs)/_layout.tsx`, and the visible-name lists below
 * (consumed by the tab bar components). Keeping the lists here gives both the
 * public bar (`CustomTabBar`) and the whitelisted bar (`NewCustomTabBar`) a
 * single source of truth.
 */

/** Tabs shown to public (non-whitelisted) users — current behavior. */
export const PUBLIC_TAB_NAMES = ['index', 'savings', 'card', 'activity'] as const;

/**
 * Tabs shown to whitelisted internal users on the redesigned bar.
 * Card is merged into the wallet page and Activity moves to a header bell, so
 * neither appears here (their routes remain registered/navigable).
 */
export const WHITELIST_TAB_NAMES = ['index', 'savings', 'rewards'] as const;

/**
 * Per-route label overrides for the whitelisted bar. Lets us render "Wallet"
 * for the `index` route without changing the route's title in `_layout.tsx`
 * (which would leak into the public bar and desktop nav).
 */
export const WHITELIST_TAB_LABELS: Record<string, string> = {
  index: 'Wallet',
};
