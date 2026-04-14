import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { CreditCard } from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  cancelPhysicalCard,
  getPhysicalCardShippingData,
  getPhysicalCardStatus,
  orderPhysicalCard,
} from '@/lib/api';

interface OrderPhysicalCardModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_STATE: ModalState = { name: 'order-physical-card', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

interface ShippingForm {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phoneNumber: string;
}

const EMPTY_FORM: ShippingForm = {
  firstName: '',
  lastName: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  countryCode: '',
  phoneNumber: '',
};

export default function OrderPhysicalCardModal({
  trigger,
  isOpen,
  onOpenChange,
}: OrderPhysicalCardModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM);
  const [physicalCardId, setPhysicalCardId] = useState<string | null>(null);
  const [hasPhysicalCard, setHasPhysicalCard] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [statusResult, shippingResult] = await Promise.all([
        getPhysicalCardStatus(),
        getPhysicalCardShippingData(),
      ]);

      if (statusResult.hasPhysicalCard && statusResult.cardId) {
        setHasPhysicalCard(true);
        setPhysicalCardId(statusResult.cardId);
      } else {
        setHasPhysicalCard(false);
        setPhysicalCardId(null);
      }

      setForm({
        firstName: shippingResult.firstName ?? '',
        lastName: shippingResult.lastName ?? '',
        line1: shippingResult.line1 ?? '',
        line2: shippingResult.line2 ?? '',
        city: shippingResult.city ?? '',
        region: shippingResult.region ?? '',
        postalCode: shippingResult.postalCode ?? '',
        countryCode: shippingResult.countryCode ?? '',
        phoneNumber: shippingResult.phoneNumber ?? '',
      });
    } catch (_error) {
      // Shipping data may not be available, continue with empty form
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const updateField = (field: keyof ShippingForm) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePlaceOrder = async () => {
    if (!form.firstName || !form.lastName || !form.line1 || !form.city || !form.postalCode || !form.countryCode || !form.phoneNumber) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await orderPhysicalCard({
        shipping: {
          firstName: form.firstName,
          lastName: form.lastName,
          line1: form.line1,
          ...(form.line2 ? { line2: form.line2 } : {}),
          city: form.city,
          ...(form.region ? { region: form.region } : {}),
          postalCode: form.postalCode,
          countryCode: form.countryCode,
          phoneNumber: form.phoneNumber,
        },
      });
      setHasPhysicalCard(true);
      setPhysicalCardId(result.id);
      Toast.show({
        type: 'success',
        text1: 'Physical card ordered',
        text2: 'Your physical card has been ordered successfully.',
      });
    } catch (_error) {
      Alert.alert('Error', 'Failed to order physical card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!physicalCardId) return;

    Alert.alert(
      'Cancel Physical Card',
      'Are you sure you want to cancel your physical card order? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCanceling(true);
              await cancelPhysicalCard(physicalCardId);
              setHasPhysicalCard(false);
              setPhysicalCardId(null);
              onOpenChange(false);
              Toast.show({
                type: 'success',
                text1: 'Physical card canceled',
                text2: 'Your physical card order has been canceled.',
              });
            } catch (_error) {
              Alert.alert('Error', 'Failed to cancel physical card. Please try again.');
            } finally {
              setIsCanceling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={hasPhysicalCard ? 'Physical Card Ordered' : 'Order Physical Card'}
      contentKey="order-physical-card"
      contentClassName="md:max-w-lg"
      shouldAnimate={false}
      disableScroll
    >
      {isLoadingData ? (
        <View className="items-center justify-center p-12">
          <ActivityIndicator size="large" color="white" />
        </View>
      ) : hasPhysicalCard ? (
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
              onPress={handleCancel}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-bold text-white">Cancel Physical Card</Text>
              )}
            </Button>
            <Button
              variant="secondary"
              className="h-14 rounded-xl border-0 bg-[#303030]"
              onPress={() => onOpenChange(false)}
              disabled={isCanceling}
            >
              <Text className="text-base font-bold text-white">Close</Text>
            </Button>
          </View>
        </View>
      ) : (
        <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
          <View className="p-6">
            <View className="mb-6 items-center">
              <View className="mb-4 items-center justify-center rounded-full bg-[#303030] p-4">
                <CreditCard size={32} color="#94F27F" />
              </View>
              <Text className="mb-2 text-center text-xl font-semibold text-white">
                Shipping details
              </Text>
              <Text className="text-center text-base text-white/60">
                Enter the address where your physical card should be shipped.
              </Text>
            </View>

            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-sm font-medium text-white/50">First name *</Text>
                  <Input
                    value={form.firstName}
                    onChangeText={updateField('firstName')}
                    placeholder="First name"
                    placeholderTextColor="#666"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-sm font-medium text-white/50">Last name *</Text>
                  <Input
                    value={form.lastName}
                    onChangeText={updateField('lastName')}
                    placeholder="Last name"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View>
                <Text className="mb-1.5 text-sm font-medium text-white/50">Address line 1 *</Text>
                <Input
                  value={form.line1}
                  onChangeText={updateField('line1')}
                  placeholder="Street address"
                  placeholderTextColor="#666"
                />
              </View>

              <View>
                <Text className="mb-1.5 text-sm font-medium text-white/50">Address line 2</Text>
                <Input
                  value={form.line2}
                  onChangeText={updateField('line2')}
                  placeholder="Apt, suite, unit (optional)"
                  placeholderTextColor="#666"
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-sm font-medium text-white/50">City *</Text>
                  <Input
                    value={form.city}
                    onChangeText={updateField('city')}
                    placeholder="City"
                    placeholderTextColor="#666"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-sm font-medium text-white/50">Region</Text>
                  <Input
                    value={form.region}
                    onChangeText={updateField('region')}
                    placeholder="State/Province"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-sm font-medium text-white/50">Postal code *</Text>
                  <Input
                    value={form.postalCode}
                    onChangeText={updateField('postalCode')}
                    placeholder="Postal code"
                    placeholderTextColor="#666"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-sm font-medium text-white/50">Country code *</Text>
                  <Input
                    value={form.countryCode}
                    onChangeText={updateField('countryCode')}
                    placeholder="US"
                    placeholderTextColor="#666"
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View>
                <Text className="mb-1.5 text-sm font-medium text-white/50">Phone number *</Text>
                <Input
                  value={form.phoneNumber}
                  onChangeText={updateField('phoneNumber')}
                  placeholder="+1234567890"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View className="mt-6 gap-4">
              <Button
                className="h-14 rounded-xl bg-[#94F27F]"
                onPress={handlePlaceOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text className="text-base font-bold text-black">Place order</Text>
                )}
              </Button>
              <Button
                variant="secondary"
                className="h-14 rounded-xl border-0 bg-[#303030]"
                onPress={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                <Text className="text-base font-bold text-white">Cancel</Text>
              </Button>
            </View>
          </View>
        </ScrollView>
      )}
    </ResponsiveModal>
  );
}
