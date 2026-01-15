import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

const DepositEmailModal: React.FC = () => {
  const { setModal } = useDepositStore();
  const { user } = useUser();

  const {
    step,
    isLoading,
    emailForm,
    otpForm,
    handleSendOtp,
    handleVerifyOtp,
    handleBack: handleEmailBack,
    handleResendOtp,
    getButtonText,
    isFormDisabled,
    rateLimitError,
    emailValue,
    setIsSkip,
  } = useEmailManagement(() => {
    // On success, proceed to deposit options
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  }, 'email');

  const currentStep = step === 'existing' ? 'email' : step;

  // Track when email modal is shown
  useEffect(() => {
    track(TRACKING_EVENTS.EMAIL_ENTRY_STARTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      context: 'deposit_flow',
      has_existing_email: !!user?.email,
    });
  }, [user?.userId, user?.safeAddress, user?.email]);

  const handleSkip = () => {
    // Track email skip
    track(TRACKING_EVENTS.EMAIL_SKIPPED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      context: 'deposit_flow',
      step: currentStep,
    });

    setIsSkip(false);
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  return (
    <View className="flex-1 gap-4">
      <View className="items-center">
        <Image
          source={getAsset('images/email.png')}
          style={{ width: 144, height: 144 }}
          contentFit="contain"
        />
      </View>

      <View className="mt-4 items-center gap-2">
        <Text className="text-center text-2xl font-bold">
          {currentStep === 'email' ? 'Email required' : 'Verify your email'}
        </Text>
        <Text
          className={cn(
            'text-center font-medium text-muted-foreground',
            currentStep === 'email' ? 'max-w-sm' : 'max-w-xs',
          )}
        >
          {currentStep === 'email'
            ? 'For your security, we require a verified email address before you can make deposits.'
            : `Enter the 6-digit verification code sent to your email address:\n${emailValue}`}
        </Text>
      </View>

      {currentStep === 'email' && (
        <View className="items-center">
          <Text className="max-w-[23rem] text-center font-medium text-muted-foreground">
            This email will be used for account recovery if you lose access to your passkey.
          </Text>
        </View>
      )}

      {rateLimitError && (
        <View className="rounded-2xl border border-red-300 p-2.5">
          <Text className="text-center text-sm text-red-400">{rateLimitError}</Text>
        </View>
      )}

      <View className="mt-6 gap-4">
        {currentStep === 'email' ? (
          <View className="gap-2">
            <Text className="font-medium text-muted-foreground">Email Address</Text>
            <Controller
              control={emailForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => {
                const InputComponent = TextInput;
                return (
                  <InputComponent
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    className="h-14 rounded-xl bg-accent px-6 text-lg font-semibold text-foreground web:focus:outline-none"
                    placeholderTextColor="#666"
                  />
                );
              }}
            />
          </View>
        ) : (
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-medium text-foreground">Verification Code</Text>
              {currentStep === 'otp' && !rateLimitError && (
                <Underline
                  onPress={handleResendOtp}
                  textClassName="text-sm group-hover:opacity-70"
                  borderColor="rgba(255, 255, 255, 1)"
                >
                  Resend verification code
                </Underline>
              )}
            </View>
            <Controller
              key="otp-input"
              control={otpForm.control}
              name="otpCode"
              render={({ field: { onChange, onBlur, value } }) => {
                const InputComponent = TextInput;
                return (
                  <InputComponent
                    placeholder="123456"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="numeric"
                    maxLength={6}
                    className="h-14 rounded-xl bg-accent px-6 text-lg font-semibold text-foreground web:focus:outline-none"
                    placeholderTextColor="#666"
                  />
                );
              }}
            />
          </View>
        )}

        <View className="gap-3">
          <Button
            onPress={
              currentStep === 'email'
                ? emailForm.handleSubmit(handleSendOtp)
                : otpForm.handleSubmit(handleVerifyOtp)
            }
            disabled={isFormDisabled()}
            variant="brand"
            className="h-14 rounded-2xl"
          >
            <Text className="text-lg font-semibold">{getButtonText()}</Text>
            {isLoading && <ActivityIndicator color="gray" />}
          </Button>

          {currentStep === 'otp' && (
            <Button
              onPress={handleEmailBack}
              variant="outline"
              disabled={isLoading}
              className="h-14 rounded-2xl border-0"
            >
              <Text className="text-lg font-semibold">Back to Email</Text>
            </Button>
          )}

          <Button onPress={handleSkip} variant="ghost" className="h-14 rounded-2xl border-0">
            <Text className="text-lg font-semibold">Skip</Text>
          </Button>
        </View>
      </View>
    </View>
  );
};

export default DepositEmailModal;
