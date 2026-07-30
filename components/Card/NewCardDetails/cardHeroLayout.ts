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

interface DestinationArgs {
  /** Window width in dp. */
  windowWidth: number;
  /** Safe-area top inset of the destination screen. */
  topInset: number;
}

/**
 * Where the card's artwork box comes to rest on the card-details screen. The card is
 * full-bleed — it spans the content container's full width, padding included — so
 * its width is the container's, capped by `max-w-lg` and centred.
 */
export const getCardHeroDestination = ({
  windowWidth,
  topInset,
}: DestinationArgs): CardHeroRect => {
  const width = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  return {
    x: (windowWidth - width) / 2,
    y: topInset + HEADER_HEIGHT + CARD_TOP_GAP - width * CARD_TOP_SHADOW_RATIO,
    width,
    height: width / NEW_CARD_ASPECT_RATIO,
  };
};
