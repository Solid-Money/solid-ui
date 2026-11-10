import { useCallback, useEffect, useRef, useState } from 'react';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import {
  openWhatsNewLink,
  type SingleWhatsNew,
  whatsNewEventBase,
  whatsNewViewedProps,
} from '@/lib/whatsNew';

import WhatsNewSingleDrawer from './WhatsNewSingleDrawer';
import WhatsNewSinglePopup from './WhatsNewSinglePopup';

import type { WatchedSecondsReader } from './WhatsNewMedia';
import type { WhatsNewCloseReason } from './WhatsNewSingle.types';

interface WhatsNewSingleProps {
  whatsNew: SingleWhatsNew;
  /** Marks it as seen on this device and hides it. */
  onClose: () => void;
}

/**
 * A single image or video What's New, shown the way the admin picked on a
 * phone — popup or bottom drawer — and always as a popup from `md` up.
 *
 * Mounted only once the image, or the video's poster, is in the cache (see
 * `LazyWhatsNewModal`), so mounting is when it appears on screen.
 */
const WhatsNewSingle = ({ whatsNew, onClose }: WhatsNewSingleProps) => {
  const { isScreenMedium } = useDimension();
  const presentation = isScreenMedium ? 'popup' : whatsNew.presentation;
  const [isClosing, setIsClosing] = useState(false);
  const closedRef = useRef(false);
  const watchedSecondsRef: WatchedSecondsReader = useRef<(() => number) | null>(null);
  const isVideo = whatsNew.media.type === 'video';
  const hasLink = !!whatsNew.link?.trim();

  // Once per showing, with the presentation it opened in.
  const viewedPresentationRef = useRef(presentation);
  useEffect(() => {
    track(
      TRACKING_EVENTS.WHATS_NEW_VIEWED,
      whatsNewViewedProps(whatsNew, viewedPresentationRef.current),
    );
  }, [whatsNew]);

  const handleClose = useCallback(
    (reason: WhatsNewCloseReason) => {
      if (closedRef.current) return;
      closedRef.current = true;
      // Stops the video now rather than when the popup unmounts.
      setIsClosing(true);

      const watched = isVideo ? (watchedSecondsRef.current?.() ?? 0) : undefined;
      const base = { ...whatsNewEventBase(whatsNew), format: 'single', watched_seconds: watched };

      if (reason === 'click') {
        track(TRACKING_EVENTS.WHATS_NEW_CLICKED, { ...base, link: whatsNew.link?.trim() });
      } else {
        track(TRACKING_EVENTS.WHATS_NEW_DISMISSED, { ...base, method: reason });
      }

      // Any close marks it as seen. Close first, so a link lands on its screen.
      onClose();
      if (reason === 'click') openWhatsNewLink(whatsNew.link);
    },
    [isVideo, onClose, whatsNew],
  );

  const handleSoundOn = useCallback(() => {
    track(TRACKING_EVENTS.WHATS_NEW_SOUND_ON, whatsNewEventBase(whatsNew));
  }, [whatsNew]);

  const mediaProps = { hasLink, onSoundOn: handleSoundOn, watchedSecondsRef };

  return presentation === 'drawer' ? (
    <WhatsNewSingleDrawer
      whatsNew={whatsNew}
      isActive={!isClosing}
      mediaProps={mediaProps}
      onRequestClose={handleClose}
    />
  ) : (
    <WhatsNewSinglePopup
      whatsNew={whatsNew}
      isActive={!isClosing}
      mediaProps={mediaProps}
      onRequestClose={handleClose}
    />
  );
};

export default WhatsNewSingle;
