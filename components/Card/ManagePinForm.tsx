import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Eye, EyeOff } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM } from '@/lib/config';
import { getCardPin, updateCardPin } from '@/lib/api';
import {
  generateSessionId,
  encryptPin,
  decryptPin,
} from '@/lib/utils/rainCardSecrets';

const PIN_VALIDATION_ERRORS = {
  LENGTH: 'PIN must be between 4 and 12 digits',
  DIGITS_ONLY: 'PIN must contain only digits',
  SIMPLE_SEQUENCE: 'PIN cannot be a simple sequence (e.g., 1234)',
  REPEATED: 'PIN cannot be all repeated digits (e.g., 1111)',
};

function isSimpleSequence(pin: string): boolean {
  for (let i = 1; i < pin.length; i++) {
    if (parseInt(pin[i]) !== parseInt(pin[i - 1]) + 1) return false;
  }
  return true;
}

function isRepeatedDigits(pin: string): boolean {
  return pin.split('').every(d => d === pin[0]);
}

function validatePin(pin: string): string | null {
  if (pin.length < 4 || pin.length > 12) return PIN_VALIDATION_ERRORS.LENGTH;
  if (!/^\d+$/.test(pin)) return PIN_VALIDATION_ERRORS.DIGITS_ONLY;
  if (isSimpleSequence(pin)) return PIN_VALIDATION_ERRORS.SIMPLE_SEQUENCE;
  if (isRepeatedDigits(pin)) return PIN_VALIDATION_ERRORS.REPEATED;
  return null;
}

export default function ManagePinForm() {
  const [pin, setPin] = useState('');
  const [existingPin, setExistingPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPin, setIsFetchingPin] = useState(true);
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExistingPin = useCallback(async () => {
    if (!EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM) {
      setIsFetchingPin(false);
      return;
    }
    try {
      setIsFetchingPin(true);
      const { secretKey, sessionId } = await generateSessionId(
        EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM,
      );
      const response = await getCardPin(sessionId);
      const decryptedPin = await decryptPin(
        response.encryptedPin.data,
        response.encryptedPin.iv,
        secretKey,
      );
      setExistingPin(decryptedPin);
      setHasExistingPin(true);
    } catch {
      // No PIN set yet or error fetching - that's OK
      setHasExistingPin(false);
    } finally {
      setIsFetchingPin(false);
    }
  }, []);

  useEffect(() => {
    fetchExistingPin();
  }, [fetchExistingPin]);

  const handleRevealPin = useCallback(() => {
    setShowPin(prev => !prev);
  }, []);

  const handleUpdatePin = useCallback(async () => {
    const validationError = validatePin(pin);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM) {
      setError('Rain card public key not configured');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { secretKey, sessionId } = await generateSessionId(
        EXPO_PUBLIC_RAIN_CARD_PUBLIC_KEY_PEM,
      );
      const { encryptedPin: encData, encodedIv } = await encryptPin(pin, secretKey);

      await updateCardPin(sessionId, { iv: encodedIv, data: encData });

      Toast.show({
        type: 'success',
        text1: 'PIN updated',
        text2: 'Your card PIN has been updated successfully.',
        visibilityTime: 4000,
      });

      setExistingPin(pin);
      setHasExistingPin(true);
      setPin('');
      setShowPin(false);
    } catch {
      setError('Failed to update PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pin]);

  const handlePinChange = useCallback((text: string) => {
    // Only allow digits
    const digitsOnly = text.replace(/[^0-9]/g, '');
    setPin(digitsOnly);
    setError(null);
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
              {showPin ? (
                <EyeOff size={20} color="#BFBFBF" />
              ) : (
                <Eye size={20} color="#BFBFBF" />
              )}
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
          <TextInput
            value={pin}
            onChangeText={handlePinChange}
            placeholder={hasExistingPin ? '****' : 'Enter PIN'}
            placeholderTextColor="#666"
            secureTextEntry
            keyboardType="number-pad"
            maxLength={12}
            className="flex-1 text-lg text-white"
            accessibilityLabel="PIN input"
          />
        </View>
        {error && (
          <Text className="mt-2 text-sm text-red-400">{error}</Text>
        )}
        <Text className="mt-2 text-xs text-white/40">
          PIN must be 4-12 digits. No simple sequences or repeated digits.
        </Text>
      </View>

      {/* Update button */}
      <Button
        onPress={handleUpdatePin}
        disabled={isLoading || pin.length < 4}
        className="mt-4 h-14 rounded-xl bg-[#94F27F]"
      >
        {isLoading ? (
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
