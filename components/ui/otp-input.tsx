import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  error?: boolean;
  disabled?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  error = false,
  disabled = false,
}: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus) {
      // Use requestAnimationFrame to ensure refs are populated after render
      const frameId = requestAnimationFrame(() => {
        inputRefs.current[0]?.focus();
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [autoFocus]);

  const handleChange = (text: string, index: number) => {
    // Only allow digits
    const digits = text.replace(/\D/g, '');

    // If multiple digits (likely a paste), handle as paste
    if (digits.length > 1) {
      handlePaste(digits);
      return;
    }

    const digit = digits.slice(-1);

    // Build new value
    const newValue = value.split('');
    newValue[index] = digit;
    const result = newValue.join('').slice(0, length);

    onChange(result);

    // Move to next input if we entered a digit
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // If current input is empty, move to previous and clear it
        const newValue = value.split('');
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    }
  };

  const handlePress = (index: number) => {
    // Focus the pressed input
    inputRefs.current[index]?.focus();
  };

  // Handle paste
  const handlePaste = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);

    // Focus last filled input or first empty
    const focusIndex = Math.min(cleaned.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <View className="flex-row justify-center gap-2">
      {Array.from({ length }).map((_, index) => (
        <Pressable
          key={index}
          onPress={() => handlePress(index)}
          className={cn('w-12 h-14 md:w-[65px] md:h-[78px] rounded-[15px] border items-center justify-center bg-[#2F2F2F]', {
            'border-transparent': !error && !value[index],
            'border-white/50': !error && value[index],
            'border-red-500': error,
            'opacity-50': disabled,
          })}
        >
          <TextInput
            ref={ref => {
              inputRefs.current[index] = ref;
            }}
            value={value[index] || ''}
            onChangeText={text => handleChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            keyboardType="number-pad"
            editable={!disabled}
            selectTextOnFocus
            className={cn(
              'text-center text-2xl font-bold text-white w-full h-full',
              Platform.OS === 'web' && 'outline-none',
            )}
            style={{
              // Remove default styling on web
              ...(Platform.OS === 'web' && {
                outline: 'none',
                backgroundColor: 'transparent',
              }),
            }}
            // Handle paste on web
            {...(Platform.OS === 'web' && {
              onPaste: (e: any) => {
                const pastedText = e.clipboardData?.getData('text') || '';
                if (pastedText) {
                  e.preventDefault();
                  handlePaste(pastedText);
                }
              },
            })}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default OtpInput;
