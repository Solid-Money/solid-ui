import { Text } from '@/components/ui/text';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';

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
        <View className="bg-red-50 p-3 rounded-lg mb-5">
          <Text className="text-red-600 text-sm">Error: {error}</Text>
        </View>
      )}

      {isLoading && (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="white" className="mb-4" />
          <Text className="text-gray-600 mb-2">Securely fetching your card details...</Text>
          <Text className="text-gray-500 text-sm">This may take a few seconds</Text>
        </View>
      )}

      {!cardDetails && !isLoading && error && (
        <View className="items-center py-8">
          <Text className="text-gray-600 mb-4 text-center">
            Unable to load card details. Please try again.
          </Text>
          <TouchableOpacity
            onPress={handleRevealDetails}
            className="bg-blue-500 p-4 rounded-lg items-center web:hover:bg-blue-600"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {cardDetails && (
        <View>
          <View className="mb-6">
            <Text className="text-xs text-gray-500 mb-2 font-medium tracking-wide">
              CARD NUMBER
            </Text>
            <Text className="text-xl font-mono tracking-wider">
              {formatCardNumber(cardDetails.card_number)}
            </Text>
          </View>

          <View className="flex-row mb-6">
            <View className="flex-1 mr-4">
              <Text className="text-xs text-gray-500 mb-2 font-medium tracking-wide">
                EXPIRY DATE
              </Text>
              <Text className="text-lg font-mono">{formatExpiryDate(cardDetails.expiry_date)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-2 font-medium tracking-wide">CVV</Text>
              <Text className="text-lg font-mono">{cardDetails.card_security_code}</Text>
            </View>
          </View>

          <View className="bg-orange-50 p-3 rounded-lg mb-6">
            <Text className="text-xs text-orange-700">
              ⚠️ Keep this information secure. Do not share or store these details.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleClose}
            className="bg-gray-600 p-4 rounded-lg items-center web:hover:bg-gray-700"
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
