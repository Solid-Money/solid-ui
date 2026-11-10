import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';

import type { WhatsNew, WhatsNewMedia, WhatsNewPresentation } from '@/lib/types';

/** A What's New popup that is one image or one video. */
export type SingleWhatsNew = WhatsNew & {
  format: 'single';
  presentation: WhatsNewPresentation;
  media: WhatsNewMedia;
};

/** How a popup was closed without a click, for `whats_new_dismissed`. */
export type WhatsNewDismissMethod = 'close_button' | 'backdrop' | 'swipe' | 'back' | 'esc';

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Whether this is a single this code can draw: an image, or a video with a
 * poster, both with a real size. Anything less draws nothing rather than a
 * broken popup.
 */
export const isSingleWhatsNew = (whatsNew: WhatsNew): whatsNew is SingleWhatsNew => {
  const { media } = whatsNew;
  if (whatsNew.format !== 'single' || !media) return false;
  if (whatsNew.presentation !== 'popup' && whatsNew.presentation !== 'drawer') return false;
  if (!media.url?.trim() || !isPositive(media.width) || !isPositive(media.height)) return false;
  if (media.type === 'image') return true;
  return media.type === 'video' && !!media.posterUrl?.trim();
};

/**
 * Whether this code can draw the popup at all. A format added after this build
 * shipped is skipped, so an over-the-air build never shows half a popup.
 */
export const canShowWhatsNew = (whatsNew: WhatsNew): boolean => {
  if (whatsNew.format === undefined || whatsNew.format === 'carousel') {
    return Array.isArray(whatsNew.steps) && whatsNew.steps.length > 0;
  }
  return isSingleWhatsNew(whatsNew);
};

/**
 * What has to be in the cache before the popup shows: the image, or the
 * video's poster (the video itself can start after).
 */
export const singleLeadImageUrl = (whatsNew: SingleWhatsNew): string =>
  (whatsNew.media.type === 'video' ? whatsNew.media.posterUrl! : whatsNew.media.url).trim();

/**
 * Opens a What's New link the same way for both formats: `http(s)://` in the
 * browser, anything else as an in-app route. Close the popup first so the
 * user lands on the destination.
 */
export const openWhatsNewLink = (link?: string) => {
  const target = link?.trim();
  if (!target) return;

  if (target.startsWith('http://') || target.startsWith('https://')) {
    void Linking.openURL(target);
  } else {
    router.push(target as any);
  }
};

export interface Size {
  width: number;
  height: number;
}

/** Popup: 16pt from each side of a phone, never wider than 440. */
const POPUP_SIDE_MARGIN = 16;
export const POPUP_MAX_WIDTH = 440;
const POPUP_MAX_HEIGHT_RATIO = 0.85;
const DRAWER_MAX_HEIGHT_RATIO = 0.9;

/**
 * The size a single is drawn at, from the media's own ratio so nothing jumps
 * when it loads and nothing is cropped.
 * - popup: min(screen − 32, 440) wide; scaled down to fit 85% of the height.
 * - drawer: full width; scaled down to fit 90% of the height.
 */
export const singleMediaSize = (
  screen: Size,
  media: Pick<WhatsNewMedia, 'width' | 'height'>,
  presentation: WhatsNewPresentation,
): Size => {
  const ratio = media.height / media.width;
  const isDrawer = presentation === 'drawer';
  const maxWidth = isDrawer
    ? screen.width
    : Math.min(screen.width - POPUP_SIDE_MARGIN * 2, POPUP_MAX_WIDTH);
  const maxHeight = screen.height * (isDrawer ? DRAWER_MAX_HEIGHT_RATIO : POPUP_MAX_HEIGHT_RATIO);
  const width = Math.max(Math.min(maxWidth, maxHeight / ratio), 0);
  return { width, height: width * ratio };
};

/** The properties every What's New event carries. */
export const whatsNewEventBase = (whatsNew: WhatsNew) => ({
  id: whatsNew._id,
  name: whatsNew.name?.trim() || whatsNew.steps?.[0]?.title?.trim() || undefined,
});

/** `whats_new_viewed` properties. */
export const whatsNewViewedProps = (whatsNew: WhatsNew, presentation: WhatsNewPresentation) => {
  const single = isSingleWhatsNew(whatsNew) ? whatsNew : null;
  return {
    ...whatsNewEventBase(whatsNew),
    format: single ? 'single' : 'carousel',
    presentation,
    media_type: single ? single.media.type : 'image',
    steps: single ? undefined : whatsNew.steps.length,
    platform: Platform.OS,
  };
};
