import { View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface CardWelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const CardWelcomePopup = ({ isOpen, onClose }: CardWelcomePopupProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[90vw] max-w-[480px] overflow-hidden border-0 border-none bg-[#1C1C1E] p-0"
      >
        <View className="relative">
          <View className="h-64 w-full">
            <Image
              source={getAsset('images/welcome-card.png')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </View>

          <DialogCloseButton className="absolute left-4 top-4 z-10 bg-black/40" />

          <View className="px-6 pt-6">
            <Text className="mb-4 text-2xl font-semibold text-white">
              Welcome to the solid card
            </Text>
            <Text className="text-base font-medium text-white/70">
              Your account is verified and your virtual Solid card is officially live. You can now
              view your card details, add it to your digital wallet, and start spending online
              instantly.
            </Text>
          </View>

          <View className="flex-row items-center justify-end px-6 pb-6 pt-6">
            <Button onPress={onClose} variant="brand" className="h-10 rounded-[12px] px-6">
              <Text className="font-bold text-black">Continue</Text>
            </Button>
          </View>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default CardWelcomePopup;
