import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  SHEET_HANDLE_HEIGHT,
  SHEET_HANDLE_PADDING,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';

import type { CardBottomSheetProps } from './CardBottomSheet.types';

const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * The web half of the card screen's shared sheet presentation: a sheet rising
 * from the bottom edge on phones, and the standard `ResponsiveModal` from `md`
 * up — the same split the cashback sheet on this screen uses, so the drag handle
 * stays with the presentation it belongs to. Native has its own Gorhom version
 * in `CardBottomSheet.native.tsx`.
 */
const CardBottomSheet = ({
  isOpen,
  onOpenChange,
  contentKey,
  designTop,
  designBottom,
  children,
}: CardBottomSheetProps) => {
  const { isScreenMedium } = useDimension();
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (isOpen) setSession(current => current + 1);
  }, [isOpen]);

  if (isScreenMedium) {
    return (
      <ResponsiveModal
        currentModal={{ name: contentKey, number: 1 }}
        previousModal={CLOSE_STATE}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        trigger={null}
        contentKey={contentKey}
        shouldAnimate={false}
        contentClassName="md:max-w-[420px]"
      >
        {/* The modal brings its own header padding, so the body starts flush. */}
        {children({ session, topPadding: 0 })}
      </ResponsiveModal>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        webPresentation="bottom-sheet"
        showCloseButton={false}
        className="max-h-[92vh] w-full max-w-none gap-0 overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
      >
        {/* Drawn over the body rather than above it, so `designTop` is the real
            distance from the sheet's edge. */}
        <View
          className="absolute left-1/2 z-10 w-[73px] -translate-x-1/2 rounded-full bg-white/20"
          style={{ height: SHEET_HANDLE_HEIGHT, top: SHEET_HANDLE_PADDING }}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: designBottom }}
        >
          {children({ session, topPadding: designTop })}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
};

export default CardBottomSheet;
