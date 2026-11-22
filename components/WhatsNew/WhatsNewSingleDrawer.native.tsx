import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { singleMediaSize } from '@/lib/whatsNew';

import WhatsNewMedia from './WhatsNewMedia';

import type { WhatsNewCloseReason, WhatsNewSingleDrawerProps } from './WhatsNewSingle.types';

/** Spec: the backdrop is black at 70%. */
const BACKDROP_OPACITY = 0.7;

/**
 * The media rising from the bottom edge, full width, with 24pt top corners and
 * the grab handle drawn over its top edge. The sheet itself is transparent and
 * has no handle of its own: the media is the sheet. Closes on the X, a tap
 * outside, a swipe down and Android back.
 */
const WhatsNewSingleDrawer = ({
  whatsNew,
  isActive,
  mediaProps,
  onRequestClose,
}: WhatsNewSingleDrawerProps) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = singleMediaSize({ width, height }, whatsNew.media, 'drawer');
  // Set by whatever starts the close; a close nothing claimed is a swipe.
  const reasonRef = useRef<WhatsNewCloseReason | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const close = useCallback((reason: WhatsNewCloseReason) => {
    if (reasonRef.current) return;
    reasonRef.current = reason;
    setIsClosing(true);
    sheetRef.current?.dismiss();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close('back');
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  // Reported once the sheet has slid away, so a link opens on a clear screen.
  const handleDismiss = useCallback(() => {
    onRequestClose(reasonRef.current ?? 'swipe');
  }, [onRequestClose]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        opacity={BACKDROP_OPACITY}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        onPress={() => {
          reasonRef.current ??= 'backdrop';
          setIsClosing(true);
        }}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      backgroundStyle={styles.transparent}
    >
      <BottomSheetView style={styles.content}>
        <WhatsNewMedia
          {...mediaProps}
          media={whatsNew.media}
          size={size}
          variant="drawer"
          // The media runs under the home bar; the sound button stays above it.
          bottomInset={insets.bottom}
          isActive={isActive && !isClosing}
          onPress={() => close('click')}
          onClose={() => close('close_button')}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  transparent: { backgroundColor: 'transparent' },
  content: { alignItems: 'center' },
});

export default WhatsNewSingleDrawer;
