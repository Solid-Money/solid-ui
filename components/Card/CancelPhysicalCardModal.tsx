import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { cancelPhysicalCard, getPhysicalCardStatus } from '@/lib/api';
import { PHYSICAL_CARD_STATUS_QUERY_KEY } from '@/components/Card/OrderPhysicalCardModal';
import { withRefreshToken } from '@/lib/utils/utils';

interface CancelPhysicalCardModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_STATE: ModalState = { name: 'cancel-physical-card', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

export default function CancelPhysicalCardModal({
  trigger,
  isOpen,
  onOpenChange,
}: CancelPhysicalCardModalProps) {
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: [PHYSICAL_CARD_STATUS_QUERY_KEY],
    queryFn: () => withRefreshToken(() => getPhysicalCardStatus()),
    enabled: isOpen,
  });

  const physicalCardId = statusData?.cardId;

  const cancelMutation = useMutation({
    mutationFn: (cardId: string) => withRefreshToken(() => cancelPhysicalCard(cardId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PHYSICAL_CARD_STATUS_QUERY_KEY] });
      onOpenChange(false);
      Toast.show({
        type: 'success',
        text1: 'Physical card canceled',
        text2: 'Your physical card order has been canceled.',
        props: { badgeText: '' },
      });
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to cancel physical card',
        text2: 'Please try again.',
        props: { badgeText: '' },
      });
    },
  });

  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Physical Card Ordered"
      contentKey="cancel-physical-card"
      contentClassName="md:max-w-lg"
      shouldAnimate={false}
    >
      {isLoadingStatus ? (
        <View className="items-center justify-center p-12">
          <ActivityIndicator size="large" color="white" />
        </View>
      ) : (
        <View className="p-6">
          <View className="mb-6 items-center">
            <View className="mb-4 items-center justify-center rounded-full bg-[#303030] p-4">
              <CreditCard size={32} color="#94F27F" />
            </View>
            <Text className="mb-2 text-center text-xl font-semibold text-white">
              Physical card ordered
            </Text>
            <Text className="text-center text-base text-white/60">
              Your physical card has been ordered and will be shipped to your address. You can cancel
              the order if needed.
            </Text>
          </View>

          <View className="gap-4">
            <Button
              className="h-14 rounded-xl bg-red-500"
              onPress={() => setIsConfirmOpen(true)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-bold text-white">Cancel Physical Card</Text>
              )}
            </Button>
            <Button
              variant="secondary"
              className="h-14 rounded-xl border-0 bg-[#303030]"
              onPress={() => onOpenChange(false)}
              disabled={cancelMutation.isPending}
            >
              <Text className="text-base font-bold text-white">Close</Text>
            </Button>
          </View>

          <Dialog open={isConfirmOpen} onOpenChange={open => !open && setIsConfirmOpen(false)}>
            <DialogContent showCloseButton={false} className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Cancel physical card?</DialogTitle>
              </DialogHeader>

              <DialogDescription className="text-base text-muted-foreground">
                Are you sure you want to cancel your physical card order? This action cannot be
                undone.
              </DialogDescription>

              <DialogFooter className="mt-4 flex-row gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 rounded-xl border-0"
                  onPress={() => setIsConfirmOpen(false)}
                  disabled={cancelMutation.isPending}
                >
                  <Text className="font-semibold">Keep order</Text>
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl border-0"
                  onPress={() => {
                    if (physicalCardId) {
                      cancelMutation.mutate(physicalCardId, {
                        onSettled: () => setIsConfirmOpen(false),
                      });
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="font-semibold text-white">Cancel card</Text>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </View>
      )}
    </ResponsiveModal>
  );
}
