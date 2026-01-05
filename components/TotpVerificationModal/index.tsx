import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const totpSchema = z.object({
  otpCode: z.string().regex(/^\d+$/, { error: 'Verification code must contain only numbers' }),
});

type TotpFormData = z.infer<typeof totpSchema>;

interface TotpVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (code: string) => Promise<void>;
  onCancel?: () => void;
}

const TotpInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}> = ({ value, onChange, onBlur: _onBlur, error }) => {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, []);

  const handlePaste = useCallback(
    (text: string) => {
      const cleaned = text.replace(/\D/g, '').slice(0, 6);
      onChange(cleaned);
      const focusIndex = Math.min(cleaned.length, 5);
      inputRefs.current[focusIndex]?.focus();
    },
    [onChange],
  );

  const handleChange = useCallback(
    (text: string, index: number) => {
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
    },
    [value, onChange, handlePaste],
  );

  const handleKeyPress = useCallback(
    (e: any, index: number) => {
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
    },
    [value, onChange],
  );

  const handlePress = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  return (
    <View className="gap-2">
      <View className="flex-row justify-center gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Pressable
            key={index}
            onPress={() => handlePress(index)}
            className={cn(
              'h-[49px] w-[39px] items-center justify-center rounded-[10px] border-2 bg-[#1c1c1c]',
              {
                'border-[rgba(255,255,255,0.7)]': index === 0 && !value[index],
                'border-transparent': index !== 0 || value[index],
                'border-red-400': error && index === 5,
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
              className="h-full w-full text-center text-xl font-bold text-white"
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
      {error && <Text className="mt-1 text-center text-xs text-red-400">{error}</Text>}
    </View>
  );
};

const TotpVerificationModalContent: React.FC<{
  onVerify: (code: string) => Promise<void>;
  onCancel?: () => void;
}> = ({ onVerify, onCancel }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string>('');

  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    watch,
  } = useForm<TotpFormData>({
    resolver: zodResolver(totpSchema),
    mode: 'onChange',
    defaultValues: {
      otpCode: '',
    },
  });

  const otpCode = watch('otpCode');

  const onSubmit = useCallback(
    async (data: TotpFormData) => {
      setIsLoading(true);
      setApiError('');
      try {
        await onVerify(data.otpCode);
      } catch (err: any) {
        console.error('Failed to verify TOTP:', err);
        const errorMessage =
          err.status === 401
            ? 'Invalid code. Please try again.'
            : 'Failed to verify TOTP. Please try again.';
        setApiError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [onVerify],
  );

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-2">
        <Text className="text-center text-2xl font-semibold text-white">
          Verify Two-Factor Authentication
        </Text>
        <Text className="max-w-xs text-center text-base font-medium text-[#ACACAC] opacity-70">
          Enter the 6-digit code from your authenticator app to verify.
        </Text>
      </View>

      {(apiError || formErrors.otpCode) && (
        <View className="rounded-2xl border border-red-300 p-2.5">
          <Text className="text-center text-sm text-red-400">
            {apiError || formErrors.otpCode?.message}
          </Text>
        </View>
      )}

      {/* OTP Input Section */}
      <View className="gap-4">
        <Controller
          control={control}
          name="otpCode"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <TotpInput value={value} onChange={onChange} onBlur={onBlur} error={error?.message} />
          )}
        />
      </View>

      {/* Action Buttons */}
      <View className="gap-3">
        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={otpCode.length !== 6 || isLoading}
          className="h-12 rounded-xl bg-[#94F27F] active:opacity-80"
        >
          {isLoading ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text className="text-base font-bold text-black">Verify</Text>
          )}
        </Button>
        {onCancel && (
          <Button
            onPress={onCancel}
            disabled={isLoading}
            variant="outline"
            className="h-12 rounded-xl border-0 bg-[#303030] active:opacity-80"
          >
            <Text className="text-base font-bold text-white">Cancel</Text>
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
        <DialogContent className="rounded-[30px] bg-[#101010] sm:max-w-md">
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
