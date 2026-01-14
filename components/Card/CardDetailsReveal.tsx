import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';

interface CardDetailsRevealProps {
  onClose?: () => void;
}

/**
 * Component for revealing and displaying card details securely
 *
 * This component demonstrates proper usage of the card details reveal functionality:
 * - Shows loading state during reveal process
 * - Displays card details in a secure manner
 * - Automatically clears sensitive data when component unmounts
 * - Handles errors gracefully
 */
export const CardDetailsReveal: React.FC<CardDetailsRevealProps> = ({ onClose }) => {
  const { cardDetails, isLoading, error, revealDetails, clearCardDetails } = useCardDetailsReveal();

  // Auto-fetch card details when component mounts
  useEffect(() => {
    revealDetails();
  }, [revealDetails]);

  // Auto-clear card details when component unmounts for security
  useEffect(() => {
    return () => {
      clearCardDetails();
    };
  }, [clearCardDetails]);

  const handleRevealDetails = async () => {
    try {
      await revealDetails();
    } catch (_err) {
      Alert.alert('Error', 'Failed to reveal card details. Please try again.');
    }
  };

  const formatCardNumber = (cardNumber: string) => {
    // Format as XXXX XXXX XXXX XXXX
    return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryDate = (expiryDate: string) => {
    // Convert YYYY-MM-DD to MM/YY format
    const date = new Date(expiryDate);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${year}`;
  };

  const handleClose = () => {
    clearCardDetails();
    onClose?.();
  };

  return (
    <View className="p-6">
      {error && (
        <View className="mb-5 rounded-lg bg-red-50 p-3">
          <Text className="text-sm text-red-600">Error: {error}</Text>
        </View>
      )}

      {isLoading && (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="white" className="mb-4" />
          <Text className="mb-2 text-gray-600">Securely fetching your card details...</Text>
          <Text className="text-sm text-gray-500">This may take a few seconds</Text>
        </View>
      )}

      {!cardDetails && !isLoading && error && (
        <View className="items-center py-8">
          <Text className="mb-4 text-center text-gray-600">
            Unable to load card details. Please try again.
          </Text>
          <TouchableOpacity
            onPress={handleRevealDetails}
            className="items-center rounded-lg bg-blue-500 p-4 web:hover:bg-blue-600"
          >
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {cardDetails && (
        <View>
          <View className="mb-6">
            <Text className="mb-2 text-xs font-medium tracking-wide text-gray-500">
              CARD NUMBER
            </Text>
            <Text className="font-mono text-xl tracking-wider">
              {formatCardNumber(cardDetails.card_number)}
            </Text>
          </View>

          <View className="mb-6 flex-row">
            <View className="mr-4 flex-1">
              <Text className="mb-2 text-xs font-medium tracking-wide text-gray-500">
                EXPIRY DATE
              </Text>
              <Text className="font-mono text-lg">{formatExpiryDate(cardDetails.expiry_date)}</Text>
            </View>
            <View className="flex-1">
              <Text className="mb-2 text-xs font-medium tracking-wide text-gray-500">CVV</Text>
              <Text className="font-mono text-lg">{cardDetails.card_security_code}</Text>
            </View>
          </View>

          <View className="mb-6 rounded-lg bg-orange-50 p-3">
            <Text className="text-xs text-orange-700">
              ⚠️ Keep this information secure. Do not share or store these details.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleClose}
            className="items-center rounded-lg bg-gray-600 p-4 web:hover:bg-gray-700"
          >
            <Text className="font-semibold text-white">Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
