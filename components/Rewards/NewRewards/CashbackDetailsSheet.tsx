import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';

import CashbackDetailsContent from './CashbackDetailsContent';

import type { CashbackDetailsSheetProps } from './CashbackDetailsSheet.types';

const MODAL_STATE: ModalState = { name: 'cashback-details', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Cashback details: a bottom sheet on phones, the standard `ResponsiveModal` from
 * `md` up — which brings the padding, close button and rounded corners a popup needs,
 * and leaves the drag handle to the sheet it belongs to.
 */
const CashbackDetailsSheet = ({
  trigger,
  onGetMoreCashback,
  ...cashbackData
}: CashbackDetailsSheetProps) => {
  const { isScreenMedium } = useDimension();
  const [open, setOpen] = useState(false);
  const [animationSession, setAnimationSession] = useState(0);

  const handleGetMoreCashback = () => {
    setOpen(false);
    onGetMoreCashback();
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAnimationSession(session => session + 1);
    }
    setOpen(nextOpen);
  };

  const content = (
    <CashbackDetailsContent
      {...cashbackData}
      animationSession={animationSession}
      isSheet={!isScreenMedium}
      onGetMoreCashback={handleGetMoreCashback}
    />
  );

  if (isScreenMedium) {
    return (
      <View className="flex-1">
        <ResponsiveModal
          currentModal={MODAL_STATE}
          previousModal={CLOSE_STATE}
          isOpen={open}
          onOpenChange={handleOpenChange}
          trigger={trigger}
          contentKey="cashback-details"
          shouldAnimate={false}
        >
          {content}
        </ResponsiveModal>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="fixed bottom-0 left-0 right-0 h-[76vh] max-w-none overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        >
          <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default CashbackDetailsSheet;
