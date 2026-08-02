import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

import TierPointsSheetContent from './TierPointsSheetContent';

import type { TierPointsSheetProps } from './TierPointsSheet.types';

// Bottom sheet on phones, the standard centred modal from `md` up.
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

  return (
    <View>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          showCloseButton={isScreenMedium}
          className={cn(
            'overflow-hidden bg-[#1C1C1C] p-0',
            isScreenMedium
              ? 'max-h-[86vh] md:max-w-lg'
              : 'fixed bottom-0 left-1/2 h-[min(792px,calc(100vh-16px))] w-full max-w-[419px] -translate-x-1/2 rounded-b-none rounded-t-[40px]',
          )}
        >
          {!isScreenMedium && (
            <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          )}
          <ScrollView showsVerticalScrollIndicator={false}>
            <TierPointsSheetContent
              animationSession={animationSession}
              onClose={() => handleOpenChange(false)}
            />
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default TierPointsSheet;
