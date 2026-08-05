import { NEW_CARD_ASPECT_RATIO } from '@/components/Card/NewCardDetails/NewCardArt';
import { CardHeroRect } from '@/store/useCardHeroStore';

/**
 * Geometry of the card-details screen's card slot, in one place, so the hero
 * transition can work out where the card is going *before* that screen exists.
 *
 * Without this the flight had to wait for the destination screen to mount, lay out
 * and report its rect — which is a visible stall between the tap and the card
 * moving. Predicting it means the animation starts on the tap's own frame and runs
 * entirely on the UI thread, so mounting the next screen can't stutter it.
 *
 * <CardDetailsHeader/> and <CardRevealSection/> lay themselves out from these same
 * constants; CardHeroTarget still measures the real rect and corrects the target if
 * it ever disagrees (e.g. the screen was left scrolled from a previous visit).
 */

/** `max-w-lg` on the screen's content container. */
export const CONTENT_MAX_WIDTH = 512;
/** `px-4` on the content container. */
export const CONTENT_PADDING = 16;
/** Header: the back button sits 15pt below the safe area and is 44pt tall. */
export const HEADER_TOP_PADDING = 15;
export const HEADER_BUTTON_SIZE = 44;
export const HEADER_HEIGHT = HEADER_TOP_PADDING + HEADER_BUTTON_SIZE;
/** Figma puts the card body 48pt below the header. */
export const CARD_TOP_GAP = 48;
/**
 * visa-platinum-card.png bakes in a drop shadow above the card body: 7.387% of the
 * artwork's height, which — the artwork being 861×555 — is 4.762% of its width.
 * The card slot cancels it with a negative margin, so the *box* starts this much
 * higher than the visible card.
 */
export const CARD_TOP_SHADOW_RATIO = 0.04762;
/** And 9.910% of the height, i.e. 6.388% of the width, below it. */
export const CARD_BOTTOM_SHADOW_RATIO = 0.06388;
/**
 * The artwork bakes shadow into each side too — 48px of its 861px width. Left
 * uncancelled it made the visible card noticeably narrower than the sections around
 * it, and the wider the column the worse it got (39px short at 640px).
 */
export const CARD_SIDE_SHADOW_RATIO = 48 / 861;
/** The visible card body's share of the artwork's width. */
export const CARD_BODY_WIDTH_RATIO = 1 - CARD_SIDE_SHADOW_RATIO * 2;
/**
 * Negative horizontal margin that grows the artwork box until the visible card body
 * spans the content column exactly — as a share of that column, so it goes in a
 * style as `${-CARD_BODY_BLEED_PERCENT}%`.
 */
export const CARD_BODY_BLEED_PERCENT = (CARD_SIDE_SHADOW_RATIO / CARD_BODY_WIDTH_RATIO) * 100;

interface DestinationArgs {
  /** Window width in dp. */
  windowWidth: number;
  /** Safe-area top inset of the destination screen. */
  topInset: number;
  /**
   * Left edge of the page the card lands on, in window coordinates. Zero on mobile,
   * where the page spans the window; the sidebar's width on desktop, where the page
   * is a column beside it (see `usePageLeft`).
   */
  pageLeft?: number;
}

/**
 * Where the card's artwork box comes to rest on the card-details screen, in window
 * coordinates. The visible card spans the content column — the container capped by
 * `max-w-lg`, less its `px-4` — so the artwork box around it is wider still by the
 * shadow it bakes into each side, and centred on the same column.
 */
export const getCardHeroDestination = ({
  windowWidth,
  topInset,
  pageLeft = 0,
}: DestinationArgs): CardHeroRect => {
  const pageWidth = windowWidth - pageLeft;
  const containerWidth = Math.min(pageWidth, CONTENT_MAX_WIDTH);
  const width = (containerWidth - CONTENT_PADDING * 2) / CARD_BODY_WIDTH_RATIO;
  return {
    x: pageLeft + (pageWidth - width) / 2,
    y: topInset + HEADER_HEIGHT + CARD_TOP_GAP - width * CARD_TOP_SHADOW_RATIO,
    width,
    height: width / NEW_CARD_ASPECT_RATIO,
  };
};
