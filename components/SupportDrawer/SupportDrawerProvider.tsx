import { useWindowDimensions, View } from 'react-native';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { closeSupportDrawer, useSupportDrawerStore } from '@/store/useSupportDrawerStore';

import SupportDrawerContent from './SupportDrawerContent';

const SupportDrawerProvider = () => {
  const isOpen = useSupportDrawerStore(state => state.isOpen);
  const { height, width } = useWindowDimensions();
  const sheetHeight = Math.min(522, height - 8);

  return (
    <View>
      <Dialog open={isOpen} onOpenChange={open => !open && closeSupportDrawer()}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="web:backdrop-blur-none"
          className="max-w-none gap-0 overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1c1c1c] p-0"
          style={{
            width: Math.min(419, width),
            height: sheetHeight,
            transform: [{ translateY: (height - sheetHeight) / 2 }],
          }}
        >
          <SupportDrawerContent />
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default SupportDrawerProvider;
