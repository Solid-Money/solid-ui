import { useCallback, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import ReferralProgramContent from '@/components/Referral/ReferralProgramContent';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ReferralProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Height of the top/bottom fade overlays that hint at more content. */
const FADE_HEIGHT = 44;
/** Slack (px) so the fades don't flicker at the exact scroll extremes. */
const SCROLL_THRESHOLD = 8;
/** Popup background (`--popup`, 0 0% 6.27% ≈ rgb(16,16,16)) for the fade colors. */
const POPUP_RGB = '16, 16, 16';

/**
 * Popup presentation of the `/referral-program` page. Shown when a whitelisted
 * user taps {@link ReferralProgramBanner} instead of navigating to the route.
 * The route (`app/(protected)/(tabs)/referral-program.tsx`) still renders the
 * same content for deep links and fallback navigation.
 *
 * Top/bottom fades appear while the content overflows to signal that there is
 * more to scroll — matching the scroll affordance used in other modals.
 */
export default function ReferralProgramModal({ isOpen, onClose }: ReferralProgramModalProps) {
  const { height } = useWindowDimensions();
  const maxHeight = Math.min(height * 0.85, 760);

  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const containerHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  const updateFades = useCallback((offsetY: number) => {
    const containerHeight = containerHeightRef.current;
    const contentHeight = contentHeightRef.current;
    const isScrollable = contentHeight > containerHeight + SCROLL_THRESHOLD;
    setShowTopFade(isScrollable && offsetY > SCROLL_THRESHOLD);
    setShowBottomFade(isScrollable && offsetY + containerHeight < contentHeight - SCROLL_THRESHOLD);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent showCloseButton={false} className="overflow-hidden border-0 p-0">
        <View className="relative">
          <ScrollView
            style={{ maxHeight }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onLayout={e => {
              containerHeightRef.current = e.nativeEvent.layout.height;
              updateFades(0);
            }}
            onContentSizeChange={(_, contentHeight) => {
              contentHeightRef.current = contentHeight;
              updateFades(0);
            }}
            onScroll={e => updateFades(e.nativeEvent.contentOffset.y)}
          >
            <ReferralProgramContent onClose={onClose} />
          </ScrollView>
          {showTopFade && (
            <LinearGradient
              colors={[`rgba(${POPUP_RGB}, 1)`, `rgba(${POPUP_RGB}, 0.5)`, `rgba(${POPUP_RGB}, 0)`]}
              locations={[0, 0.4, 1]}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: FADE_HEIGHT }}
            />
          )}
          {showBottomFade && (
            <LinearGradient
              colors={[`rgba(${POPUP_RGB}, 0)`, `rgba(${POPUP_RGB}, 0.5)`, `rgba(${POPUP_RGB}, 1)`]}
              locations={[0, 0.6, 1]}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_HEIGHT }}
            />
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}
