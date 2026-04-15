import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { CreditCard } from 'lucide-react-native';
import { z } from 'zod';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getPhysicalCardShippingData, orderPhysicalCard } from '@/lib/api';
import { cn, withRefreshToken } from '@/lib/utils/utils';

export const PHYSICAL_CARD_STATUS_QUERY_KEY = 'physicalCardStatus';
const SHIPPING_DATA_QUERY_KEY = 'physicalCardShippingData';

interface OrderPhysicalCardModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_STATE: ModalState = { name: 'order-physical-card', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

const shippingSchema = z.object({
  firstName: z
    .string()
    .min(1, { message: 'First name is required' })
    .max(50)
    .regex(/^[a-zA-Z -]+$/, { message: 'Only Latin characters, spaces, and hyphens' }),
  lastName: z
    .string()
    .min(1, { message: 'Last name is required' })
    .max(50)
    .regex(/^[a-zA-Z -]+$/, { message: 'Only Latin characters, spaces, and hyphens' }),
  line1: z.string().min(1, { message: 'Address is required' }).max(100),
  line2: z.string().max(100).optional().or(z.literal('')),
  city: z.string().min(1, { message: 'City is required' }).max(50),
  region: z.string().max(50).optional().or(z.literal('')),
  postalCode: z.string().min(1, { message: 'Postal code is required' }).max(9),
  countryCode: z
    .string()
    .length(2, { message: 'Must be 2-letter code' })
    .regex(/^[A-Z]{2}$/, { message: 'Must be 2 uppercase letters' }),
  phoneNumber: z.string().min(1, { message: 'Phone number is required' }),
});

type ShippingFormData = z.infer<typeof shippingSchema>;

export default function OrderPhysicalCardModal({
  trigger,
  isOpen,
  onOpenChange,
}: OrderPhysicalCardModalProps) {
  const queryClient = useQueryClient();

  const { data: shippingData } = useQuery({
    queryKey: [SHIPPING_DATA_QUERY_KEY],
    queryFn: () => withRefreshToken(() => getPhysicalCardShippingData()),
    enabled: isOpen,
    staleTime: 0,
  });

  const { control, handleSubmit, formState, reset } = useForm<ShippingFormData>({
    resolver: zodResolver(shippingSchema) as any,
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      line1: '',
      line2: '',
      city: '',
      region: '',
      postalCode: '',
      countryCode: '',
      phoneNumber: '',
    },
  });

  useEffect(() => {
    if (shippingData) {
      reset({
        firstName: shippingData.firstName ?? '',
        lastName: shippingData.lastName ?? '',
        line1: shippingData.line1 ?? '',
        line2: shippingData.line2 ?? '',
        city: shippingData.city ?? '',
        region: shippingData.region ?? '',
        postalCode: shippingData.postalCode ?? '',
        countryCode: shippingData.countryCode?.toUpperCase() ?? '',
        phoneNumber: shippingData.phoneNumber ?? '',
      });
    }
  }, [shippingData, reset]);

  const orderMutation = useMutation({
    mutationFn: (data: ShippingFormData) =>
      withRefreshToken(() =>
        orderPhysicalCard({
          shipping: {
            firstName: data.firstName,
            lastName: data.lastName,
            line1: data.line1,
            ...(data.line2 ? { line2: data.line2 } : {}),
            city: data.city,
            ...(data.region ? { region: data.region } : {}),
            postalCode: data.postalCode,
            countryCode: data.countryCode,
            phoneNumber: data.phoneNumber,
          },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PHYSICAL_CARD_STATUS_QUERY_KEY] });
      onOpenChange(false);
      Toast.show({
        type: 'success',
        text1: 'Physical card ordered',
        text2: 'Your physical card has been ordered successfully.',
        props: { badgeText: '' },
      });
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to order physical card',
        text2: 'Please try again.',
        props: { badgeText: '' },
      });
    },
  });

  const onSubmit = useCallback(
    (data: ShippingFormData) => {
      orderMutation.mutate(data);
    },
    [orderMutation],
  );

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
      disableScroll
    >
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
              <View className="flex-1 gap-1.5">
                <Text className="font-medium opacity-50">First name *</Text>
                <View
                  className={cn(
                    'rounded-2xl bg-accent px-5 py-3',
                    formState.errors.firstName && 'border border-red-500',
                  )}
                >
                  <Controller
                    control={control}
                    name="firstName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="text-lg font-semibold text-white web:focus:outline-none"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="First name"
                        placeholderTextColor="#666"
                      />
                    )}
                  />
                </View>
                {formState.errors.firstName && (
                  <Text className="text-sm text-red-500">
                    {formState.errors.firstName.message}
                  </Text>
                )}
              </View>
              <View className="flex-1 gap-1.5">
                <Text className="font-medium opacity-50">Last name *</Text>
                <View
                  className={cn(
                    'rounded-2xl bg-accent px-5 py-3',
                    formState.errors.lastName && 'border border-red-500',
                  )}
                >
                  <Controller
                    control={control}
                    name="lastName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="text-lg font-semibold text-white web:focus:outline-none"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Last name"
                        placeholderTextColor="#666"
                      />
                    )}
                  />
                </View>
                {formState.errors.lastName && (
                  <Text className="text-sm text-red-500">
                    {formState.errors.lastName.message}
                  </Text>
                )}
              </View>
            </View>

            <FormField
              control={control}
              name="line1"
              label="Address line 1 *"
              placeholder="Street address"
              error={formState.errors.line1?.message}
            />

            <FormField
              control={control}
              name="line2"
              label="Address line 2"
              placeholder="Apt, suite, unit (optional)"
              error={formState.errors.line2?.message}
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField
                  control={control}
                  name="city"
                  label="City *"
                  placeholder="City"
                  error={formState.errors.city?.message}
                />
              </View>
              <View className="flex-1">
                <FormField
                  control={control}
                  name="region"
                  label="Region"
                  placeholder="State/Province"
                  error={formState.errors.region?.message}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField
                  control={control}
                  name="postalCode"
                  label="Postal code *"
                  placeholder="Postal code"
                  error={formState.errors.postalCode?.message}
                />
              </View>
              <View className="flex-1">
                <FormField
                  control={control}
                  name="countryCode"
                  label="Country code *"
                  placeholder="US"
                  error={formState.errors.countryCode?.message}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <FormField
              control={control}
              name="phoneNumber"
              label="Phone number *"
              placeholder="+1234567890"
              error={formState.errors.phoneNumber?.message}
              keyboardType="phone-pad"
            />
          </View>

          <View className="mt-6 gap-4">
            <Button
              className="h-14 rounded-xl bg-[#94F27F]"
              onPress={handleSubmit(onSubmit)}
              disabled={orderMutation.isPending}
            >
              {orderMutation.isPending ? (
                <ActivityIndicator color="black" />
              ) : (
                <Text className="text-base font-bold text-black">Place order</Text>
              )}
            </Button>
            <Button
              variant="secondary"
              className="h-14 rounded-xl border-0 bg-[#303030]"
              onPress={() => onOpenChange(false)}
              disabled={orderMutation.isPending}
            >
              <Text className="text-base font-bold text-white">Cancel</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </ResponsiveModal>
  );
}

function FormField({
  control,
  name,
  label,
  placeholder,
  error,
  keyboardType,
  maxLength,
  autoCapitalize,
}: {
  control: any;
  name: string;
  label: string;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'phone-pad' | 'decimal-pad' | 'number-pad';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-medium opacity-50">{label}</Text>
      <View
        className={cn(
          'rounded-2xl bg-accent px-5 py-3',
          error && 'border border-red-500',
        )}
      >
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="text-lg font-semibold text-white web:focus:outline-none"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor="#666"
              keyboardType={keyboardType}
              maxLength={maxLength}
              autoCapitalize={autoCapitalize}
            />
          )}
        />
      </View>
      {error && <Text className="text-sm text-red-500">{error}</Text>}
    </View>
  );
}
