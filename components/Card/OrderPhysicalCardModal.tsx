import React, { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { CreditCard } from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { orderPhysicalCard } from '@/lib/api';

interface OrderPhysicalCardModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_STATE: ModalState = { name: 'order-physical-card', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

export default function OrderPhysicalCardModal({
  trigger,
  isOpen,
  onOpenChange,
}: OrderPhysicalCardModalProps) {
  const [isOrdering, setIsOrdering] = useState(false);

  const handleOrder = async () => {
    try {
      setIsOrdering(true);
      await orderPhysicalCard();
      onOpenChange(false);
      Toast.show({
        type: 'success',
        text1: 'Physical card ordered',
        text2: 'Your physical card has been ordered successfully.',
      });
    } catch (_error) {
      Alert.alert('Error', 'Failed to order physical card. Please try again.');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Order Physical Card"
      contentKey="order-physical-card"
      contentClassName="md:max-w-lg"
      shouldAnimate={false}
    >
      <View className="p-6">
        <View className="mb-6 items-center">
          <View className="mb-4 items-center justify-center rounded-full bg-[#303030] p-4">
            <CreditCard size={32} color="#94F27F" />
          </View>
          <Text className="mb-2 text-center text-xl font-semibold text-white">
            Get your physical card
          </Text>
          <Text className="text-center text-base text-white/60">
            Order a physical Solid card delivered to your address. The card will need to be activated
            once received.
          </Text>
        </View>

        <View className="gap-4">
          <Button
            className="h-14 rounded-xl bg-[#94F27F]"
            onPress={handleOrder}
            disabled={isOrdering}
          >
            {isOrdering ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text className="text-base font-bold text-black">Order Physical Card</Text>
            )}
          </Button>
          <Button
            variant="secondary"
            className="h-14 rounded-xl border-0 bg-[#303030]"
            onPress={() => onOpenChange(false)}
            disabled={isOrdering}
          >
            <Text className="text-base font-bold text-white">Cancel</Text>
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
}
