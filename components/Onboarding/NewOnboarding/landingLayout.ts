/**
 * Layout metrics for the onboarding landing hero.
 *
 * The screen was translated straight out of Figma as absolutely-positioned text
 * pinned to hard-coded `top` offsets measured on the 390x844 design frame. That
 * cannot reflow: once the headline needed a third line — a wider phone still
 * capped at the frame's 303pt text column, or iOS Dynamic Type scaling the 44pt
 * type up — it grew *through* the description underneath it instead of pushing
 * it down. On an iPhone 13 Pro Max the headline ran from 157 to 289 while the
 * description stayed pinned at 268, so the two overlapped by 21pt.
 *
 * These metrics drive a normal flow layout instead, and are kept pure so the
 * no-overlap guarantee can be asserted across a device matrix in tests (the app
 * has no react renderer under jest). On the 390x844 reference device they
 * reproduce the Figma geometry exactly — lockup at 97, title at 157,
 * description at 268 — so the design is unchanged where it was already correct.
 */

/** Width of the Figma design frame the original offsets were measured on. */
const FIGMA_FRAME_WIDTH = 390;
/** Width of the centred text column in that frame. */
const FIGMA_TEXT_WIDTH = 303;
/** Text column as a share of the viewport, so wider phones get a wider column. */
const TEXT_COLUMN_RATIO = FIGMA_TEXT_WIDTH / FIGMA_FRAME_WIDTH;

/** Horizontal gutter, matching the CTA's own left/right inset. */
const SCREEN_PADDING = 20;
/** Minimum breathing room when a device reports no safe-area inset. */
const MIN_INSET = 20;
/** Small-screen breakpoint (iPhone SE), matching OnboardingPage/LegacyOnboarding. */
const SMALL_SCREEN_HEIGHT = 700;

/** Rendered height of the Solid logo lockup. */
export const LOGO_LOCKUP_HEIGHT = 27.092;

/** Height of the "Get started" CTA. */
const CTA_HEIGHT = 54;
/** Gap between the CTA and the safe-area bottom, above the login link. */
const CTA_BOTTOM_GAP = 48;

/**
 * Largest Dynamic Type multiplier the hero honours. Uncapped, an accessibility
 * text size scales the 44pt headline far past anything the screen can hold;
 * 1.2 matches the cap already used on the home screen's wallet actions.
 */
export const MAX_FONT_SCALE = 1.2;

export type LandingLayoutInput = {
  /** Viewport width in dp. */
  width: number;
  /** Viewport height in dp. */
  height: number;
  /** Safe-area top inset in dp. */
  topInset: number;
  /** Safe-area bottom inset in dp. */
  bottomInset: number;
};

export type LandingLayout = {
  /** Top padding for the hero column, measured from the top of the viewport. */
  paddingTop: number;
  /** Width of the centred text column. */
  textWidth: number;
  titleFontSize: number;
  titleLineHeight: number;
  /** Gap between the logo lockup and the headline. */
  titleMarginTop: number;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  /** Gap between the headline and the description. */
  descriptionMarginTop: number;
  /** Safe-area bottom inset, floored so the CTA never sits flush to the edge. */
  bottomInset: number;
};

export function getLandingLayout({
  width,
  height,
  topInset,
  bottomInset,
}: LandingLayoutInput): LandingLayout {
  const isSmallScreen = height < SMALL_SCREEN_HEIGHT;

  // Figma pins the lockup 97pt down a frame whose status bar is 47pt, i.e. 50pt
  // below the safe area. Tracking the inset keeps that spacing honest on devices
  // with a taller status bar or a Dynamic Island.
  const paddingTop = Math.max(topInset, MIN_INSET) + (isSmallScreen ? 28 : 50);

  const descriptionFontSize = isSmallScreen ? 16 : 18;

  return {
    paddingTop,
    textWidth: Math.min(width - SCREEN_PADDING * 2, Math.round(width * TEXT_COLUMN_RATIO)),
    titleFontSize: isSmallScreen ? 36 : 44,
    // Figma sets the headline's line height equal to its font size.
    titleLineHeight: isSmallScreen ? 36 : 44,
    titleMarginTop: isSmallScreen ? 20 : 33,
    descriptionFontSize,
    descriptionLineHeight: Math.round(descriptionFontSize * 1.2 * 10) / 10,
    descriptionMarginTop: isSmallScreen ? 16 : 23,
    bottomInset: Math.max(bottomInset, MIN_INSET),
  };
}

/**
 * Bottom edge of the hero text block for a given number of rendered lines.
 *
 * Line counts are an input rather than something measured here: the point is to
 * assert the block still clears the CTA even when the text wraps further than
 * the design assumed, which is the exact failure the pinned layout could not
 * survive.
 */
export function getHeroContentBottom(
  layout: LandingLayout,
  titleLineCount: number,
  descriptionLineCount: number,
  fontScale = 1,
): number {
  return (
    layout.paddingTop +
    LOGO_LOCKUP_HEIGHT +
    layout.titleMarginTop +
    layout.titleLineHeight * fontScale * titleLineCount +
    layout.descriptionMarginTop +
    layout.descriptionLineHeight * fontScale * descriptionLineCount
  );
}

/** Top edge of the "Get started" CTA, which is anchored to the bottom inset. */
export function getCtaTop(layout: LandingLayout, height: number): number {
  return height - layout.bottomInset - CTA_BOTTOM_GAP - CTA_HEIGHT;
}
