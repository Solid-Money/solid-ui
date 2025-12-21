import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { isAddress } from 'viem';
import { ArrowRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface ToInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  showContinueButton?: boolean;
  onContinue?: () => void;
  onSubmitEditing?: () => void;
  showArrowButton?: boolean;
  onArrowPress?: () => void;
  isValid?: boolean;
}

const ToInput: React.FC<ToInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Address or name',
  error,
  showContinueButton = true,
  onContinue,
  onSubmitEditing,
  isValid: isValidProp,
}) => {
  const isValidAddress = value.trim() && isAddress(value.trim());
  const isValid = isValidProp !== undefined ? isValidProp : isValidAddress;

  return (
    <View className="gap-4">
      <Text className="text-base opacity-70 font-medium">To</Text>
      <View className="flex-row items-center gap-2 bg-card rounded-2xl p-5">
        <TextInput
          className={cn('flex-1 text-white text-base web:focus:outline-none')}
          placeholder={placeholder}
          placeholderTextColor="#ffffff80"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
        />
        {showContinueButton && isValid && onContinue && (
          <Pressable
            onPress={onContinue}
            className="h-10 w-10 flex items-center justify-center bg-popover rounded-full web:transition-colors web:hover:bg-muted"
          >
            <ArrowRight size={20} color="white" />
          </Pressable>
        )}
      </View>
      {error && <Text className="text-red-400 text-sm">{error}</Text>}
    </View>
  );
};

export default ToInput;
