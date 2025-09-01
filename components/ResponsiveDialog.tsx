import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { ReactNode, useCallback, useRef } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

export interface ResponsiveDialogProps {
  // Modal state management
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Content
  trigger?: ReactNode;
  title?: string;
  children: ReactNode;

  // Styling
  contentClassName?: string;
  titleClassName?: string;
}

const ResponsiveDialog = ({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  contentClassName,
  titleClassName,
}: ResponsiveDialogProps) => {
  const { isDesktop } = useDimension();
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    onOpenChange(true);
  }, [onOpenChange]);

  // Handle bottom sheet presentation when isOpen changes
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !isDesktop) {
      if (open) {
        bottomSheetModalRef.current?.present();
      } else {
        bottomSheetModalRef.current?.dismiss();
      }
    }
  }, [open, isDesktop]);

  const handleBottomSheetOpenChange = useCallback(
    (index: number) => {
      onOpenChange(index >= 0);
    },
    [onOpenChange],
  );

  // Use modal for desktop web, bottom sheet for mobile web and native
  if (Platform.OS === 'web' && isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className={cn('p-6 md:p-8 md:max-w-md', contentClassName)}>
          {title && (
            <DialogHeader className={titleClassName}>
              <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
            </DialogHeader>
          )}
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  // Use bottom sheet for mobile web and native
  return (
    <View>
      {trigger && <View onTouchEnd={handlePresentModalPress}>{trigger}</View>}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        onChange={handleBottomSheetOpenChange}
        snapPoints={['85%']}
        backgroundStyle={{
          backgroundColor: 'black',
        }}
        handleIndicatorStyle={{
          backgroundColor: 'white',
        }}
        onDismiss={() => onOpenChange(false)}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustPan"
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
            paddingTop: 12,
          }}
        >
          <View className="gap-6">
            {title && (
              <View className={cn('pb-2', titleClassName)}>
                <Text className="text-2xl font-semibold text-white text-center">{title}</Text>
              </View>
            )}
            <View>{children}</View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default ResponsiveDialog;
