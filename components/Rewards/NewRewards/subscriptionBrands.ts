import { type AssetPath } from '@/lib/assets';

/**
 * The subscription services eligible for subscription cashback, grouped into
 * the categories the rewards program bills them under.
 *
 * Shared by the tier comparison screen (which draws the logos as a compact
 * overlapping stack per category) and the subscription cashback sheet (which
 * lists every brand by name), so the two can never disagree about what's
 * eligible.
 *
 * Assets are named after the file they were exported as, which doesn't always
 * match the brand they draw — hence the explicit `name` on every entry.
 */
export interface SubscriptionBrand {
  /** Brand name as the design writes it. */
  name: string;
  asset: AssetPath;
  /**
   * Glyph size at {@link REFERENCE_BADGE_SIZE}. `scaleBrandGlyph` scales it for
   * badges drawn at any other size.
   */
  width: number;
  height: number;
  /**
   * Circle drawn behind the glyph. Entries without one were exported with their
   * own circle and card-colored ring already baked in.
   */
  background?: string;
  /** Second glyph stacked on top — the design draws Disney+ as two assets. */
  overlay?: { asset: AssetPath; width: number; height: number };
}

export interface SubscriptionCategory {
  key: string;
  /** Heading form, as the category rows and cards title it. */
  label: string;
  /**
   * Mid-sentence form for "on AI, streaming, music". Spelled out per category
   * rather than lower-cased from `label`, which would turn AI into "ai".
   */
  sentenceLabel: string;
  brands: SubscriptionBrand[];
}

/** Badge size the `width`/`height` on every brand below are measured at. */
export const REFERENCE_BADGE_SIZE = 22;

export const SUBSCRIPTION_CATEGORIES: SubscriptionCategory[] = [
  {
    key: 'ai',
    sentenceLabel: 'AI',
    label: 'AI',
    brands: [
      {
        name: 'OpenAI',
        asset: 'images/rewards-tiers/logo-generic-3.svg',
        width: REFERENCE_BADGE_SIZE,
        height: REFERENCE_BADGE_SIZE,
      },
      {
        name: 'Claude',
        asset: 'images/rewards-tiers/logo-claude.svg',
        width: 15,
        height: 15,
        background: '#D97757',
      },
      {
        name: 'Gemini',
        asset: 'images/rewards-tiers/logo-gemini.svg',
        width: 18,
        height: 18,
        background: '#FFFFFF',
      },
    ],
  },
  {
    key: 'streaming',
    sentenceLabel: 'streaming',
    label: 'Streaming',
    brands: [
      {
        name: 'Netflix',
        asset: 'images/rewards-tiers/logo-netflix.svg',
        width: 8,
        height: 15,
        background: '#000000',
      },
      {
        name: 'Disney',
        asset: 'images/rewards-tiers/logo-disney-1.svg',
        width: 16,
        height: 16,
        background: '#FFFFFF',
        overlay: { asset: 'images/rewards-tiers/logo-disney-2.svg', width: 17, height: 17 },
      },
      {
        name: 'HBO Max',
        asset: 'images/rewards-tiers/logo-generic-4.svg',
        width: REFERENCE_BADGE_SIZE,
        height: REFERENCE_BADGE_SIZE,
      },
      {
        name: 'Amazon Prime',
        asset: 'images/rewards-tiers/logo-generic-1.svg',
        width: 14,
        height: 14,
        background: '#FFFFFF',
      },
      {
        name: 'Apple TV',
        asset: 'images/rewards-tiers/logo-generic-5.svg',
        width: REFERENCE_BADGE_SIZE,
        height: REFERENCE_BADGE_SIZE,
      },
    ],
  },
  {
    key: 'music',
    sentenceLabel: 'music',
    label: 'Music',
    brands: [
      {
        // Exported as logo-openai.svg, but it draws the Spotify mark.
        name: 'Spotify',
        asset: 'images/rewards-tiers/logo-openai.svg',
        width: REFERENCE_BADGE_SIZE,
        height: REFERENCE_BADGE_SIZE,
      },
      {
        name: 'Apple Music',
        asset: 'images/rewards-tiers/logo-generic-5.svg',
        width: REFERENCE_BADGE_SIZE,
        height: REFERENCE_BADGE_SIZE,
      },
      {
        name: 'Youtube Music',
        asset: 'images/rewards-tiers/logo-generic-2.svg',
        width: 16,
        height: 11.2,
        background: '#FFFFFF',
      },
    ],
  },
];

/**
 * Glyph dimensions for a brand drawn in a badge of `badgeSize`. The design
 * scales every glyph with its badge, so the ratio to
 * {@link REFERENCE_BADGE_SIZE} carries across sizes.
 */
export const scaleBrandGlyph = (glyph: { width: number; height: number }, badgeSize: number) => {
  const ratio = badgeSize / REFERENCE_BADGE_SIZE;
  return { width: glyph.width * ratio, height: glyph.height * ratio };
};

/** Comma-joined category names for mid-sentence copy: "AI, streaming, music". */
export const subscriptionCategoriesSentence = () =>
  SUBSCRIPTION_CATEGORIES.map(category => category.sentenceLabel).join(', ');
