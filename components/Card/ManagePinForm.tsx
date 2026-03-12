import React, { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getCardPin, updateCardPin } from '@/lib/api';
import { EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM } from '@/lib/config';
import { decryptPin, encryptPin, generateSessionId } from '@/lib/utils/rainCardSecrets';
import { withRefreshToken } from '@/lib/utils/utils';

function isSimpleSequence(pin: string): boolean {
  for (let i = 1; i < pin.length; i++) {
    if (parseInt(pin[i]) !== parseInt(pin[i - 1]) + 1) return false;
  }
  return true;
}

function isRepeatedDigits(pin: string): boolean {
  return pin.split('').every(d => d === pin[0]);
}

const pinSchema = z.object({
  pin: z
    .string()
    .min(4, { message: 'PIN must be between 4 and 12 digits' })
    .max(12, { message: 'PIN must be between 4 and 12 digits' })
    .regex(/^\d+$/, { message: 'PIN must contain only digits' })
    .refine(val => !isSimpleSequence(val), {
      message: 'PIN cannot be a simple sequence (e.g., 1234)',
    })
    .refine(val => !isRepeatedDigits(val), {
      message: 'PIN cannot be all repeated digits (e.g., 1111)',
    }),
});

type PinFormData = z.infer<typeof pinSchema>;

const CARD_PIN_QUERY_KEY = 'cardPin';

export default function ManagePinForm() {
  const [showPin, setShowPin] = useState(false);
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<PinFormData>({
    resolver: zodResolver(pinSchema) as any,
    mode: 'onChange',
    defaultValues: { pin: '' },
  });

  const { data: existingPin, isLoading: isFetchingPin } = useQuery({
    queryKey: [CARD_PIN_QUERY_KEY],
    queryFn: async () => {
      if (!EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM) return null;
      const { secretKey, sessionId } = await generateSessionId(
        EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM,
      );
      const response = await withRefreshToken(() => getCardPin(sessionId));
      return decryptPin(response.encryptedPin.data, response.encryptedPin.iv, secretKey);
    },
    retry: false,
  });

  const hasExistingPin = !!existingPin;

  const updatePinMutation = useMutation({
    mutationFn: async (pin: string) => {
      if (!EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM) {
        throw new Error('Rain card public key not configured');
      }
      const { secretKey, sessionId } = await generateSessionId(
        EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM,
      );
      const { encryptedPin: encData, encodedIv } = await encryptPin(pin, secretKey);
      return withRefreshToken(() => updateCardPin(sessionId, { iv: encodedIv, data: encData }));
    },
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'PIN updated',
        text2: 'Your card PIN has been updated successfully.',
        visibilityTime: 4000,
      });
      reset();
      setShowPin(false);
      queryClient.invalidateQueries({ queryKey: [CARD_PIN_QUERY_KEY] });
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to update PIN',
        text2: 'Please try again.',
      });
    },
  });

  const onSubmit = useCallback(
    (data: PinFormData) => {
      updatePinMutation.mutate(data.pin);
    },
    [updatePinMutation],
  );

  const handleRevealPin = useCallback(() => {
    setShowPin(prev => !prev);
  }, []);

  if (isFetchingPin) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 px-1 pt-4">
      <Text className="mb-2 text-sm text-white/60">
        {hasExistingPin ? 'Enter a new PIN to update your card PIN' : 'Set a PIN for your card'}
      </Text>

      {/* Existing PIN display */}
      {hasExistingPin && (
        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-white/70">Current PIN</Text>
          <View className="flex-row items-center rounded-xl bg-[#1E1E1E] px-4 py-3">
            <Text className="flex-1 text-lg tracking-[8px] text-white">
              {showPin && existingPin ? existingPin : '****'}
            </Text>
            <Pressable
              onPress={handleRevealPin}
              className="p-2 web:hover:opacity-70"
              accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
              accessibilityRole="button"
            >
              {showPin ? <EyeOff size={20} color="#BFBFBF" /> : <Eye size={20} color="#BFBFBF" />}
            </Pressable>
          </View>
        </View>
      )}

      {/* New PIN input */}
      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-white/70">
          {hasExistingPin ? 'New PIN' : 'PIN'}
        </Text>
        <View className="flex-row items-center rounded-xl bg-[#1E1E1E] px-4 py-3">
          <Controller
            control={control}
            name="pin"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={text => onChange(text.replace(/[^0-9]/g, ''))}
                onBlur={onBlur}
                placeholder={hasExistingPin ? '****' : 'Enter PIN'}
                placeholderTextColor="#666"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={12}
                className="flex-1 text-lg text-white"
                accessibilityLabel="PIN input"
              />
            )}
          />
        </View>
        {errors.pin && <Text className="mt-2 text-sm text-red-400">{errors.pin.message}</Text>}
        <Text className="mt-2 text-xs text-white/40">
          PIN must be 4-12 digits. No simple sequences or repeated digits.
        </Text>
      </View>

      {/* Update button */}
      <Button
        onPress={handleSubmit(onSubmit)}
        disabled={updatePinMutation.isPending || !isValid}
        className="mt-4 h-14 rounded-xl bg-[#94F27F]"
      >
        {updatePinMutation.isPending ? (
          <ActivityIndicator size="small" color="black" />
        ) : (
          <Text className="text-base font-bold text-black">
            {hasExistingPin ? 'Update PIN' : 'Set PIN'}
          </Text>
        )}
      </Button>
    </View>
  );
}
