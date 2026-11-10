import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { singleMediaSize } from '@/lib/whatsNew';

import WhatsNewMedia from './WhatsNewMedia';

import type { WhatsNewCloseReason, WhatsNewSingleDrawerProps } from './WhatsNewSingle.types';

/** A drag past this, or a flick faster than this, closes the drawer. */
const SWIPE_CLOSE_DISTANCE = 80;
const SWIPE_CLOSE_VELOCITY = 600;
/** How long the shared web sheet takes to slide away (dialog.tsx), plus a frame. */
const SHEET_EXIT_MS = 200;

/**
 * The phone-web drawer: the shared web bottom sheet from `components/ui/dialog`
 * (what `CardBottomSheet` uses on web), made transparent so the media is the
 * sheet. Closes on the X, a tap outside, Esc and a swipe down. From `md` up the
 * container shows the popup instead; native has its own Gorhom version.
 */
const WhatsNewSingleDrawer = ({
  whatsNew,
  isActive,
  mediaProps,
  onRequestClose,
}: WhatsNewSingleDrawerProps) => {
  const { width, height } = useWindowDimensions();
  const size = singleMediaSize({ width, height }, whatsNew.media, 'drawer');
  const [isOpen, setIsOpen] = useState(true);
  const reasonRef = useRef<WhatsNewCloseReason | null>(null);
  const escapeRef = useRef(false);
  // A drag ends with a click on whatever is under the pointer; that click must
  // not count as a tap on the media.
  const draggedRef = useRef(false);
  const translateY = useSharedValue(0);

  const close = useCallback((reason: WhatsNewCloseReason) => {
    if (reasonRef.current) return;
    reasonRef.current = reason;
    setIsOpen(false);
  }, []);

  // Reported once the sheet has slid away, so a link opens on a clear screen.
  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => onRequestClose(reasonRef.current ?? 'backdrop'), SHEET_EXIT_MS);
    return () => clearTimeout(timer);
  }, [isOpen, onRequestClose]);

  const markDragged = useCallback(() => {
    draggedRef.current = true;
  }, []);
  const clearDragged = useCallback(() => {
    setTimeout(() => {
      draggedRef.current = false;
    }, 50);
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .onStart(() => {
      scheduleOnRN(markDragged);
    })
    .onUpdate(event => {
      translateY.value = Math.max(event.translationY, 0);
    })
    .onEnd(event => {
      if (event.translationY > SWIPE_CLOSE_DISTANCE || event.velocityY > SWIPE_CLOSE_VELOCITY) {
        scheduleOnRN(close, 'swipe');
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    })
    .onFinalize(() => {
      scheduleOnRN(clearDragged);
    });

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) close(escapeRef.current ? 'esc' : 'backdrop');
      }}
    >
      <DialogContent
        webPresentation="bottom-sheet"
        showCloseButton={false}
        overlayClassName="bg-black/70 web:backdrop-blur-none"
        className="w-full max-w-none items-center gap-0 rounded-none bg-transparent p-0"
        onEscapeKeyDown={() => {
          escapeRef.current = true;
        }}
      >
        <GestureDetector gesture={pan}>
          <Animated.View style={dragStyle}>
            <WhatsNewMedia
              {...mediaProps}
              media={whatsNew.media}
              size={size}
              variant="drawer"
              isActive={isActive && isOpen}
              onPress={() => {
                if (!draggedRef.current) close('click');
              }}
              onClose={() => close('close_button')}
            />
          </Animated.View>
        </GestureDetector>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsNewSingleDrawer;
