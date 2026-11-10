import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useDimension } from '@/hooks/useDimension';
import { singleMediaSize, type SingleWhatsNew } from '@/lib/whatsNew';

import WhatsNewMedia, { type WhatsNewMediaProps } from './WhatsNewMedia';

import type { WhatsNewCloseReason } from './WhatsNewSingle.types';

/** Spec: the backdrop is black at 70%. */
const BACKDROP = 'rgba(0, 0, 0, 0.7)';

export interface WhatsNewSinglePopupProps {
  whatsNew: SingleWhatsNew;
  isActive: boolean;
  mediaProps: Pick<WhatsNewMediaProps, 'hasLink' | 'onSoundOn' | 'watchedSecondsRef'>;
  onRequestClose: (reason: WhatsNewCloseReason) => void;
}

/**
 * The media centred over a dark backdrop: min(screen − 32, 440) wide, at the
 * media's own ratio, scaled down to fit 85% of the screen height. Closes on
 * the X, a tap outside, Esc on web and Android back.
 *
 * A native `Modal` (its own window), so it covers tab bars and sheets the way
 * the Spend mode help does.
 */
const WhatsNewSinglePopup = ({
  whatsNew,
  isActive,
  mediaProps,
  onRequestClose,
}: WhatsNewSinglePopupProps) => {
  const { width, height } = useWindowDimensions();
  const { isScreenMedium } = useDimension();
  const size = singleMediaSize({ width, height }, whatsNew.media, 'popup');

  // The same entrance the shared dialog uses for each screen size.
  const entering = isScreenMedium
    ? FadeIn.duration(150)
    : FadeInDown.springify().stiffness(300).damping(12).mass(0.8);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      // Android back; Esc on web.
      onRequestClose={() => onRequestClose(Platform.OS === 'web' ? 'esc' : 'back')}
    >
      <View style={styles.root}>
        <Pressable
          onPress={() => onRequestClose('backdrop')}
          style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }]}
          accessible={false}
          importantForAccessibility="no"
        />
        <Animated.View entering={entering}>
          <WhatsNewMedia
            {...mediaProps}
            media={whatsNew.media}
            size={size}
            variant="popup"
            isActive={isActive}
            onPress={() => onRequestClose('click')}
            onClose={() => onRequestClose('close_button')}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default WhatsNewSinglePopup;
