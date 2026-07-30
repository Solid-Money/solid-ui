import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import TierPointsSheetContent from './TierPointsSheetContent';

import type { TierPointsSheetProps } from './TierPointsSheet.types';

const TierPointsSheet = ({ trigger }: TierPointsSheetProps) => {
  const [open, setOpen] = useState(false);
  const [animationSession, setAnimationSession] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAnimationSession(session => session + 1);
    }
    setOpen(nextOpen);
  };

  return (
    <View>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="fixed bottom-0 left-1/2 h-[min(792px,calc(100vh-16px))] w-full max-w-[419px] -translate-x-1/2 overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        >
          <View className="absolute left-1/2 top-4 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
          <ScrollView showsVerticalScrollIndicator={false}>
            <TierPointsSheetContent
              animationSession={animationSession}
              onClose={() => setOpen(false)}
            />
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default TierPointsSheet;
