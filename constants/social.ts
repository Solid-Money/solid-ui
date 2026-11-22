/**
 * Solid's own social accounts, for "Follow us" in Settings. The same accounts
 * the help center footer links to (solid-backend, help/site/site-pages.ts).
 */
export type SocialNetwork = 'x' | 'telegram';

export interface SocialLink {
  network: SocialNetwork;
  /** The row title. */
  label: string;
  /** Shown on the right of the row. */
  handle: string;
  url: string;
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { network: 'x', label: 'X', handle: '@SolidYield', url: 'https://x.com/SolidYield' },
  {
    network: 'telegram',
    label: 'Telegram',
    handle: '@SolidYield',
    url: 'https://t.me/SolidYield',
  },
];
