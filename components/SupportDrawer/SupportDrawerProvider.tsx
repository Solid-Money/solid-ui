import { useWindowDimensions, View } from 'react-native';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';
import { closeSupportDrawer, useSupportDrawerStore } from '@/store/useSupportDrawerStore';

import SupportDrawerContent from './SupportDrawerContent';

/**
 * Bottom sheet on phones, the standard centred modal from `md` up. The sheet
 * styling — and the translate that pinned it to the bottom of the viewport —
 * used to apply at every width.
 */
const SupportDrawerProvider = () => {
  const isOpen = useSupportDrawerStore(state => state.isOpen);
  const { isScreenMedium } = useDimension();
  const { height, width } = useWindowDimensions();
  const sheetHeight = Math.min(522, height - 8);

  return (
    <View>
      <Dialog open={isOpen} onOpenChange={open => !open && closeSupportDrawer()}>
        <DialogContent
          showCloseButton={isScreenMedium}
          overlayClassName="web:backdrop-blur-none"
          className={cn(
            'gap-0 overflow-hidden bg-[#1c1c1c] p-0',
            isScreenMedium ? 'md:max-w-lg' : 'max-w-none rounded-b-none rounded-t-[40px]',
          )}
          style={
            isScreenMedium
              ? undefined
              : {
                  width: Math.min(419, width),
                  height: sheetHeight,
                  transform: [{ translateY: (height - sheetHeight) / 2 }],
                }
          }
        >
          <SupportDrawerContent />
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default SupportDrawerProvider;
