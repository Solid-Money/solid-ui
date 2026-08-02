import { useWindowDimensions, View } from 'react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { closeSupportDrawer, useSupportDrawerStore } from '@/store/useSupportDrawerStore';

import SupportDrawerContent from './SupportDrawerContent';

const MODAL_STATE: ModalState = { name: 'support', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Help & Support: a bottom sheet on phones, the standard `ResponsiveModal` from `md`
 * up. The sheet styling — the drag handle, and the translate that pinned the card to
 * the bottom of the viewport — used to apply at every width.
 */
const SupportDrawerProvider = () => {
  const isOpen = useSupportDrawerStore(state => state.isOpen);
  const { isScreenMedium } = useDimension();
  const { height, width } = useWindowDimensions();
  const sheetHeight = Math.min(522, height - 8);

  const handleOpenChange = (open: boolean) => {
    if (!open) closeSupportDrawer();
  };

  if (isScreenMedium) {
    return (
      <View>
        <ResponsiveModal
          currentModal={MODAL_STATE}
          previousModal={CLOSE_STATE}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          trigger={null}
          contentKey="support"
          shouldAnimate={false}
        >
          <SupportDrawerContent isSheet={false} />
        </ResponsiveModal>
      </View>
    );
  }

  return (
    <View>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
