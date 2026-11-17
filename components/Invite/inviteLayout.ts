/**
 * Metrics for the public invite page, from Figma 31314:3674 ("Refer page v4 — version C2"):
 * the Desktop 1440 frame (31314:3675) and the Mobile 390 frame (31318:3674).
 *
 * The frames place most things absolutely. Here they drive a flow layout instead, so a
 * longer headline or a second line of copy pushes what follows down rather than under it.
 * At the frames' own copy the flow reproduces their geometry.
 */

/** The Solid lockup's natural size (`LandingScreen`'s two SVGs side by side). */
export const LOGO_LOCKUP = { width: 92.046, height: 27.092, markTop: 3.02, wordLeft: 28.53 };

/** The cut-out card images' own aspect ratio (assets/images/invite). */
export const CARD_ASPECT = 540 / 396.44;

export interface InviteLayout {
  /** The widest the centred column grows. */
  columnWidth: number;
  header: { height: number; paddingX: number; logoWidth: number; loginFontSize: number };
  /** The light behind the hero, and the fade to black over its lower part. */
  backdrop: {
    lightHeight: number;
    lightOpacity: number;
    fadeTop: number;
    fadeHeight: number;
    /** Where the hero section clips the light. */
    clipHeight: number;
  };
  hero: { paddingTop: number; paddingBottom: number };
  pill: { height: number; avatar: number; initialFontSize: number; fontSize: number };
  /** The card sits at the top of a box `boxRatio` times its width tall. */
  card: { marginTop: number; maxWidth: number; boxRatio: number };
  title: { paddingTop: number; fontSize: number; lineHeight: number; letterSpacing: number };
  subtitle: { paddingTop: number; fontSize: number; lineHeight: number; maxWidth: number };
  actions: { paddingTop: number; gap: number };
  footnote: { fontSize: number; lineHeight: number };
  steps: {
    paddingTop: number;
    paddingBottom: number;
    paddingX: number;
    rowHeight: number;
    rowPaddingX: number;
    fontSize: number;
    learnMoreTop: number;
  };
  footer: { paddingTop: number; paddingBottom: number; paddingX: number };
}

export const DESKTOP_LAYOUT: InviteLayout = {
  columnWidth: 560,
  header: { height: 88, paddingX: 88, logoWidth: 87.9375, loginFontSize: 15 },
  backdrop: { lightHeight: 967, lightOpacity: 1, fadeTop: 407, fadeHeight: 560, clipHeight: 1118 },
  hero: { paddingTop: 88, paddingBottom: 64 },
  pill: { height: 40, avatar: 28, initialFontSize: 14, fontSize: 15 },
  card: { marginTop: 12, maxWidth: 540, boxRatio: 396 / 540 },
  title: { paddingTop: 12, fontSize: 72, lineHeight: 73.44, letterSpacing: -2.16 },
  subtitle: { paddingTop: 18, fontSize: 19, lineHeight: 27.55, maxWidth: 520 },
  actions: { paddingTop: 32, gap: 12 },
  footnote: { fontSize: 14, lineHeight: 20.3 },
  steps: {
    paddingTop: 24,
    paddingBottom: 96,
    paddingX: 88,
    rowHeight: 64,
    rowPaddingX: 20,
    fontSize: 17,
    learnMoreTop: 16,
  },
  footer: { paddingTop: 24, paddingBottom: 36, paddingX: 88 },
};

export const MOBILE_LAYOUT: InviteLayout = {
  columnWidth: 560,
  header: { height: 60, paddingX: 20, logoWidth: 74.40625, loginFontSize: 14 },
  backdrop: { lightHeight: 760, lightOpacity: 0.5, fadeTop: 345, fadeHeight: 380, clipHeight: 725 },
  hero: { paddingTop: 84, paddingBottom: 28.5 },
  pill: { height: 36, avatar: 26, initialFontSize: 13, fontSize: 14 },
  card: { marginTop: 14, maxWidth: 350, boxRatio: 270 / 350 },
  title: { paddingTop: 8, fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  subtitle: { paddingTop: 12, fontSize: 16, lineHeight: 23.2, maxWidth: 560 },
  // The frame centres a 130pt block that its content overflows, which puts the button
  // 14.5pt under the copy.
  actions: { paddingTop: 14.5, gap: 4 },
  footnote: { fontSize: 13, lineHeight: 18.85 },
  steps: {
    paddingTop: 12,
    paddingBottom: 48,
    paddingX: 20,
    rowHeight: 60,
    rowPaddingX: 18,
    fontSize: 16,
    learnMoreTop: 24,
  },
  footer: { paddingTop: 20, paddingBottom: 32, paddingX: 20 },
};

/** The fade's stops: transparent to black, as the frames' gradient. */
export const FADE_COLORS = [
  'rgba(0,0,0,0)',
  'rgba(0,0,0,0.05)',
  'rgba(0,0,0,0.18)',
  'rgba(0,0,0,0.42)',
  'rgba(0,0,0,0.74)',
  'rgb(0,0,0)',
] as const;
export const FADE_LOCATIONS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

/**
 * Mona Sans Regular's average advance at the headline's tracking, as a share of its size.
 * Both frames measure 0.46 ("Get $10 to spend" is 297pt at 40pt and 531pt at 72pt); a
 * little over that leaves room for wider glyphs.
 */
const TITLE_EM_PER_CHARACTER = 0.47;

/**
 * How far to shrink the headline so each of its lines fits `columnWidth` on one line, as
 * the frames set it: 1 at the frames' widths, less on a narrow phone, never more.
 */
export const inviteTitleScale = (
  layout: InviteLayout,
  columnWidth: number,
  title: string,
): number => {
  const longest = Math.max(1, ...title.split('\n').map(line => line.length));
  const fits = columnWidth / (longest * TITLE_EM_PER_CHARACTER * layout.title.fontSize);
  return Math.min(1, Math.max(0, fits));
};

/** The card's width on a screen `width` wide: the frame's, or less on a narrow screen. */
export const inviteCardWidth = (layout: InviteLayout, width: number): number =>
  Math.max(0, Math.min(layout.card.maxWidth, width - 2 * layout.steps.paddingX));
