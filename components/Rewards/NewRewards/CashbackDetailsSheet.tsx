import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

import CashbackDetailsContent from './CashbackDetailsContent';

import type { CashbackDetailsSheetProps } from './CashbackDetailsSheet.types';

// Bottom sheet on phones, the standard centred modal from `md` up — the sheet
// styling used to apply at every width, so on desktop it stretched across the
// whole viewport with square top corners.
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

  return (
    <View className="flex-1">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          showCloseButton={isScreenMedium}
          className={cn(
            'overflow-hidden bg-[#1C1C1C] p-0',
            isScreenMedium
              ? 'max-h-[86vh] md:max-w-lg'
              : 'fixed bottom-0 left-0 right-0 h-[76vh] max-w-none rounded-b-none rounded-t-[40px]',
          )}
        >
          {!isScreenMedium && (
            <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          )}
          <ScrollView showsVerticalScrollIndicator={false}>
            <CashbackDetailsContent
              {...cashbackData}
              animationSession={animationSession}
              onGetMoreCashback={handleGetMoreCashback}
            />
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default CashbackDetailsSheet;
