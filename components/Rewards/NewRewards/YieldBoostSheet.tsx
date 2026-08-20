import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';

import YieldBoostContent from './YieldBoostContent';

import type { YieldBoostSheetProps } from './YieldBoostSheet.types';

const MODAL_STATE: ModalState = { name: 'yield-boost', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Yield boost details: a bottom sheet on phones, the standard `ResponsiveModal`
 * from `md` up — the same split `CashbackDetailsSheet` uses.
 */
const YieldBoostSheet = ({
  trigger,
  triggerContainerClassName = 'flex-1',
  ...yieldBoostData
}: YieldBoostSheetProps) => {
  const { isScreenMedium } = useDimension();
  const [open, setOpen] = useState(false);
  const [animationSession, setAnimationSession] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAnimationSession(session => session + 1);
    }
    setOpen(nextOpen);
  };

  const content = (
    <YieldBoostContent
      {...yieldBoostData}
      animationSession={animationSession}
      isSheet={!isScreenMedium}
      onClose={() => handleOpenChange(false)}
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
          contentKey="yield-boost"
          shouldAnimate={false}
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
          className="h-[49vh] w-full max-w-none overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        >
          <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default YieldBoostSheet;
