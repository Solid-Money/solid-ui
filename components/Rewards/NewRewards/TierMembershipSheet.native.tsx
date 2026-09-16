import { useCallback, useEffect, useRef } from 'react';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import TierMembershipSheetContent from './TierMembershipSheetContent';

import type { TierMembershipSheetProps } from './TierMembershipSheet.types';

const TierMembershipSheet = ({ open, onOpenChange }: TierMembershipSheetProps) => {
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

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
      // Sized to its content: the sheet has a lock block, a membership block or
      // both, and a fixed height would leave a gap under the shortest of them.
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: '#1C1C1C',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
      }}
      handleStyle={{ paddingBottom: 0, paddingTop: 20 }}
      handleIndicatorStyle={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 73,
        height: 5,
      }}
      onDismiss={() => onOpenChange(false)}
    >
      <BottomSheetView>
        <TierMembershipSheetContent onClose={() => onOpenChange(false)} />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default TierMembershipSheet;
