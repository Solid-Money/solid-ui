import { useState } from 'react';
import { View } from 'react-native';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import type { SelectSheetProps } from './SelectSheet.types';

/**
 * Default / web-mobile reusable "pill → sheet" primitive. Gorhom bottom sheets
 * are native-only in this repo, so the base variant uses the Dialog primitive;
 * the native override lives in SelectSheet.native.tsx.
 */
const SelectSheet = ({ trigger, title, children }: SelectSheetProps) => {
  const [open, setOpen] = useState(false);
  const dismiss = () => setOpen(false);

  return (
    <View className="items-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="gap-1 p-4">
          <DialogTitle className="px-2 pb-1 text-lg text-muted-foreground">{title}</DialogTitle>
          {children(dismiss)}
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default SelectSheet;
