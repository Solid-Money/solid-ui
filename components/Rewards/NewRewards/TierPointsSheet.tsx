import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';

import TierPointsSheetContent from './TierPointsSheetContent';

import type { TierPointsSheetProps } from './TierPointsSheet.types';

const MODAL_STATE: ModalState = { name: 'tier-points', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };
// React Native's web Modal sits at z-index 9999. This sheet is portalled to the
// document body, so it needs to clear that layer when opened from Rewards help.
const WEB_OVERLAY_CLASS_NAME = 'z-[10000]';

/**
 * How points work: a bottom sheet on phones, the standard `ResponsiveModal` from
 * `md` up.
 */
const TierPointsSheet = ({ trigger, open: controlledOpen, onOpenChange }: TierPointsSheetProps) => {
  const { isScreenMedium } = useDimension();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [animationSession, setAnimationSession] = useState(0);
  const open = controlledOpen ?? uncontrolledOpen;
  const isControlled = controlledOpen !== undefined;

  useEffect(() => {
    if (isControlled && open) {
      setAnimationSession(session => session + 1);
    }
  }, [isControlled, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      if (nextOpen) {
        setAnimationSession(session => session + 1);
      }
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const content = (
    <TierPointsSheetContent
      animationSession={animationSession}
      isSheet={!isScreenMedium}
      onClose={() => handleOpenChange(false)}
    />
  );

  if (isScreenMedium) {
    return (
      <View>
        <ResponsiveModal
          currentModal={MODAL_STATE}
          previousModal={CLOSE_STATE}
          isOpen={open}
          onOpenChange={handleOpenChange}
          trigger={trigger ?? null}
          contentKey="tier-points"
          shouldAnimate={false}
          overlayClassName={WEB_OVERLAY_CLASS_NAME}
        >
          {content}
        </ResponsiveModal>
      </View>
    );
  }

  return (
    <View>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          showCloseButton={false}
          webPresentation="bottom-sheet"
          overlayClassName={WEB_OVERLAY_CLASS_NAME}
          className="h-[min(792px,calc(100vh-16px))] w-full max-w-[419px] overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        >
          <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default TierPointsSheet;
