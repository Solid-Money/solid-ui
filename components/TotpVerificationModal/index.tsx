import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface TotpVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (code: string) => Promise<void>;
  onCancel?: () => void;
}

const TotpInput: React.FC<{ value: string; onChange: (value: string) => void }> = ({
  value,
  onChange,
}) => {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, []);

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length > 1) {
      handlePaste(digits);
      return;
    }

    const digit = digits.slice(-1);
    const newValue = value.split('');
    newValue[index] = digit;
    const result = newValue.join('').slice(0, 6);
    onChange(result);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!value[index] && index > 0) {
        const newValue = value.split('');
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    }
  };

  const handlePress = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handlePaste = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    onChange(cleaned);
    const focusIndex = Math.min(cleaned.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <View className="flex-row justify-center gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Pressable
          key={index}
          onPress={() => handlePress(index)}
          className={cn(
            'h-[49px] w-[39px] rounded-[10px] bg-[#1c1c1c] border-2 items-center justify-center',
            {
              'border-[rgba(255,255,255,0.7)]': index === 0 && !value[index],
              'border-transparent': index !== 0 || value[index],
            },
          )}
        >
          <TextInput
            ref={ref => {
              inputRefs.current[index] = ref;
            }}
            value={value[index] || ''}
            onChangeText={text => handleChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            keyboardType="number-pad"
            selectTextOnFocus
            className="text-center text-xl font-bold text-white w-full h-full"
            style={{
              ...(Platform.OS === 'web' && {
                outline: 'none',
                backgroundColor: 'transparent',
              }),
            }}
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
};

const TotpVerificationModalContent: React.FC<{
  onVerify: (code: string) => Promise<void>;
  onCancel?: () => void;
}> = ({ onVerify, onCancel }) => {
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async () => {
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    setError('');
    try {
      await onVerify(otpCode);
    } catch (err: any) {
      console.error('Failed to verify TOTP:', err);
      const errorMessage =
        err.status === 401
          ? 'Invalid code. Please try again.'
          : 'Failed to verify TOTP. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-2">
        <Text className="text-2xl font-semibold text-center text-white">
          Verify Two-Factor Authentication
        </Text>
        <Text className="text-[#ACACAC] text-center font-medium text-base max-w-xs opacity-70">
          Enter the 6-digit code from your authenticator app to verify.
        </Text>
      </View>

      {error && (
        <View className="p-2.5 border border-red-300 rounded-2xl">
          <Text className="text-red-400 text-sm text-center">{error}</Text>
        </View>
      )}

      {/* OTP Input Section */}
      <View className="gap-4">
        <TotpInput value={otpCode} onChange={setOtpCode} />
      </View>

      {/* Action Buttons */}
      <View className="gap-3">
        <Button
          onPress={handleSubmit}
          disabled={otpCode.length !== 6 || isLoading}
          className="rounded-xl h-12 bg-[#94F27F] active:opacity-80"
        >
          {isLoading ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text className="text-black text-base font-bold">Verify</Text>
          )}
        </Button>
        {onCancel && (
          <Button
            onPress={onCancel}
            disabled={isLoading}
            variant="outline"
            className="rounded-xl h-12 bg-[#303030] border-0 active:opacity-80"
          >
            <Text className="text-white text-base font-bold">Cancel</Text>
          </Button>
        )}
      </View>
    </View>
  );
};

export const TotpVerificationModal: React.FC<TotpVerificationModalProps> = ({
  open,
  onOpenChange,
  onVerify,
  onCancel,
}) => {
  if (Platform.OS === 'web') {
    return (
      <Dialog open={open} onOpenChange={onCancel}>
        <DialogContent className="sm:max-w-md bg-[#101010] rounded-[30px]">
          <DialogHeader className="flex-row items-center justify-end">
            <DialogTitle className="sr-only">Verify Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          <View className="p-6">
            <TotpVerificationModalContent onVerify={onVerify} onCancel={onCancel} />
          </View>
        </DialogContent>
      </Dialog>
    );
  }

  const modalState = {
    name: 'totp-verification-modal',
    number: 1,
  };
  const closedModalState = {
    name: 'close',
    number: 0,
  };

  return (
    <ResponsiveModal
      isOpen={open}
      onOpenChange={onOpenChange}
      currentModal={open ? modalState : closedModalState}
      previousModal={closedModalState}
      trigger={null}
      title="Verify Two-Factor Authentication"
      contentKey="totp-verification-modal"
    >
      <View className="p-6">
        <TotpVerificationModalContent onVerify={onVerify} onCancel={onCancel} />
      </View>
    </ResponsiveModal>
  );
};
