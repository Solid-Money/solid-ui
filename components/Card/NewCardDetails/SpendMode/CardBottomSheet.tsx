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
        // The modal's stock chrome is sized for phones blown up: a 40px inset on every side,
        // then a 50px close button on a row of its own and a 32px gap under it, all before
        // the body's own 17pt inset. At 420px that left ~306px for a body built for 385, so
        // figures wrapped and the amount field clipped. Here the header is hidden — the body
        // puts a compact close button in its own first row — the inset is 24px all round,
        // and the body drops its 17pt inset, which leaves 432px of content.
        hideHeader
        // The body scrolls in its own view below, so the bottom inset can match the top one;
        // the stock scroll view adds a fixed 40px under the content.
        disableScroll
        contentClassName="md:max-w-[480px] md:px-6 md:pt-6 md:pb-6"
      >
        <ScrollView className="web:max-h-[85vh]" showsVerticalScrollIndicator={false}>
          {children({ session, topPadding: 0, presentation: 'modal' })}
        </ScrollView>
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
