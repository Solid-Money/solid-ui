import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { setupTotp, verifyTotp } from '@/lib/api';
import { cn } from '@/lib/utils';

const totpSchema = z.object({
  otpCode: z
    .string()
    .length(6, { error: 'Verification code must be exactly 6 digits' })
    .regex(/^\d+$/, { error: 'Verification code must contain only numbers' }),
});

type TotpFormData = z.infer<typeof totpSchema>;

interface SecurityTotpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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

const SecurityTotpModalContent: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [qrCode, setQrCode] = useState<string>('');
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

  // Fetch TOTP setup data when modal opens
  useEffect(() => {
    const fetchTotpSetup = async () => {
      setIsLoadingSetup(true);
      setApiError('');
      try {
        const { qrCode } = await setupTotp();
        setQrCode(qrCode);
      } catch (err: any) {
        console.error('Failed to setup TOTP:', err);
        setApiError('Failed to setup TOTP. Please try again.');
      } finally {
        setIsLoadingSetup(false);
      }
    };

    fetchTotpSetup();
  }, []);

  const onSubmit = useCallback(
    async (data: TotpFormData) => {
      setIsLoading(true);
      setApiError('');
      try {
        const result = await verifyTotp(data.otpCode);
        if (result.verified && onSuccess) {
          onSuccess();
        }
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
    [onSuccess],
  );

  return (
    <View className="flex-1 gap-4">
      <View className="items-center gap-2">
        <Text className="text-center text-2xl font-bold text-white">Two-Factor Authentication</Text>
        <Text className="max-w-xs text-center text-base font-medium text-[#ACACAC] opacity-70">
          Scan the below QR code or manually enter the code in an authenticator app like Authy or
          1Password.
        </Text>
      </View>

      {(apiError || formErrors.otpCode) && (
        <View className="rounded-2xl border border-red-300 p-2.5">
          <Text className="text-center text-sm text-red-400">
            {apiError || formErrors.otpCode?.message}
          </Text>
        </View>
      )}

      {/* QR Code Section */}
      <View className="items-center gap-3">
        {isLoadingSetup ? (
          <View className="min-h-[300px] items-center justify-center rounded-[15px] bg-[#1c1c1c] p-8">
            <ActivityIndicator color="#94F27F" size="large" />
          </View>
        ) : (
          <View className="min-h-[250px] min-w-[250px] items-center justify-center rounded-[15px] bg-[#1c1c1c] p-8">
            {qrCode && (
              <Image
                source={{
                  uri: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`,
                }}
                alt="QR code"
                style={{ width: 256, height: 256 }}
                contentFit="contain"
                onError={error => {
                  console.error('QR code image error:', error);
                  setApiError('Failed to load QR code image');
                }}
              />
            )}
            {/* {!showManualEntry && (
              <Pressable onPress={() => setShowManualEntry(true)} className="mt-4">
                <Text className="text-[rgba(255,255,255,0.7)] text-sm font-medium text-center">
                  Can&apos;t scan the QR code?
                </Text>
              </Pressable>
            )}
            {showManualEntry && (
              <View className="mt-4 items-center gap-2">
                <Text className="text-[rgba(255,255,255,0.7)] text-sm font-medium text-center">
                  Manual entry code:
                </Text>
                <Text className="text-white text-base font-semibold font-mono">{manualCode}</Text>
              </View>
            )} */}
          </View>
        )}
      </View>

      {/* OTP Input Section */}
      <View className="gap-4">
        <Text className="text-center text-base font-medium text-[#ACACAC] opacity-70">
          Enter the 6-digit code from your authenticator app to verify.
        </Text>
        <Controller
          control={control}
          name="otpCode"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <TotpInput value={value} onChange={onChange} onBlur={onBlur} error={error?.message} />
          )}
        />
      </View>

      {/* Submit Button */}
      <View className="gap-3">
        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={otpCode.length !== 6 || isLoading}
          className="h-12 rounded-xl bg-[#94F27F] active:opacity-80"
        >
          {isLoading ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text className="text-base font-bold text-black">Submit</Text>
          )}
        </Button>
      </View>
    </View>
  );
};

export const SecurityTotpModal: React.FC<SecurityTotpModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const modalState = {
    name: 'security-totp-modal',
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
      title="Two-Factor Authentication"
      contentKey="security-totp-modal"
    >
      <View className="p-6">
        <SecurityTotpModalContent onSuccess={onSuccess} />
      </View>
    </ResponsiveModal>
  );
};
