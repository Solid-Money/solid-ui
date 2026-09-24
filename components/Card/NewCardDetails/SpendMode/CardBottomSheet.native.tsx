import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import {
  SHEET_HANDLE_HEIGHT,
  SHEET_HANDLE_PADDING,
  SHEET_HANDLE_SPACE,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';

import type { CardBottomSheetProps } from './CardBottomSheet.types';

/**
 * The presentation the card screen's spend surfaces share on native: a Gorhom
 * sheet rising from the bottom edge, 40pt top corners, the 73 × 5 handle.
 *
 * It sizes itself to its content rather than snapping to a height, because these
 * sheets change height as you move through them — Smart shows two cards where
 * Cash shows one. Gorhom animates that, so the sheet grows on the same curve the
 * content swaps on instead of leaving a gap under the shorter states.
 */
const CardBottomSheet = ({
  isOpen,
  onOpenChange,
  designTop,
  designBottom,
  children,
}: CardBottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  // Reopening has to reset whatever the body was last showing. The body keys off
  // this rather than being remounted, so the sheet's own entry is untouched.
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSession(current => current + 1);
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [isOpen]);

  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.8}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      // The repay step has a field. Without this the sheet stays lifted after the keyboard
      // is dismissed, floating over a gap where the keyboard used to be.
      keyboardBlurBehavior="restore"
      onDismiss={dismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: '#1C1C1C',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
      }}
      handleStyle={{ paddingBottom: 0, paddingTop: SHEET_HANDLE_PADDING }}
      handleIndicatorStyle={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 73,
        height: SHEET_HANDLE_HEIGHT,
      }}
    >
      <BottomSheetView style={{ paddingBottom: designBottom + insets.bottom }}>
        {/* The handle is laid out above the body here, so it has already spent
            part of the distance Figma measures from the sheet's top edge. */}
        {children({ session, topPadding: Math.max(designTop - SHEET_HANDLE_SPACE, 0) })}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default CardBottomSheet;
