import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { RewardsTier } from '@/lib/types';

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
  onUpgradeTier,
  triggerContainerClassName = 'flex-1',
  ...subscriptionData
}: SubscriptionCashbackSheetProps) => {
  const { isScreenMedium } = useDimension();
  const [open, setOpen] = useState(false);
  const [animationSession, setAnimationSession] = useState(0);

  const handleGetMoreCashback = () => {
    setOpen(false);
    if (onUpgradeTier) {
      onUpgradeTier(
        subscriptionData.currentTier === RewardsTier.CORE ? RewardsTier.PRIME : RewardsTier.ULTRA,
      );
    } else {
      onGetMoreCashback();
    }
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAnimationSession(session => session + 1);
    }
    setOpen(nextOpen);
  };

  const content = (
    <>
      <DialogTitle className="sr-only">Category cashback</DialogTitle>
      <DialogDescription className="sr-only">
        Cashback rates and eligible merchants by category.
      </DialogDescription>
      <SubscriptionCashbackContent
        key={animationSession}
        {...subscriptionData}
        animationSession={animationSession}
        isSheet={!isScreenMedium}
        onGetMoreCashback={handleGetMoreCashback}
        onDismiss={() => setOpen(false)}
      />
    </>
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
          // Longer categories scroll within the modal on short windows.
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
          overlayClassName="web:fixed"
          showCloseButton={false}
          className="h-[784px] max-h-[90vh] w-full max-w-none overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        >
          <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default SubscriptionCashbackSheet;
