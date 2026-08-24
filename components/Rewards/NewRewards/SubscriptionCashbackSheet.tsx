import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';

import SubscriptionCashbackContent from './SubscriptionCashbackContent';

import type { SubscriptionCashbackSheetProps } from './SubscriptionCashbackSheet.types';

const MODAL_STATE: ModalState = { name: 'subscription-cashback', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Subscription cashback details: a bottom sheet on phones, the standard
 * `ResponsiveModal` from `md` up — the same split `CashbackDetailsSheet` uses.
 */
const SubscriptionCashbackSheet = ({
  trigger,
  onGetMoreCashback,
  triggerContainerClassName = 'flex-1',
  ...subscriptionData
}: SubscriptionCashbackSheetProps) => {
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
    <SubscriptionCashbackContent
      {...subscriptionData}
      animationSession={animationSession}
      isSheet={!isScreenMedium}
      onGetMoreCashback={handleGetMoreCashback}
    />
  );

  if (isScreenMedium) {
    return (
      <View className={triggerContainerClassName}>
        <ResponsiveModal
          currentModal={MODAL_STATE}
          previousModal={CLOSE_STATE}
          isOpen={open}
          onOpenChange={handleOpenChange}
          trigger={trigger}
          contentKey="subscription-cashback"
          shouldAnimate={false}
          // Eleven merchant rows overflow the viewport on short desktop
          // windows; cap the card so the close button stays put and only the
          // body scrolls.
          fillViewportHeight
        >
          {content}
        </ResponsiveModal>
      </View>
    );
  }

  return (
    <View className={triggerContainerClassName}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          webPresentation="bottom-sheet"
          className="h-[90vh] w-full max-w-none overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        >
          <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default SubscriptionCashbackSheet;
