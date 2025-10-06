import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface NotificationEmailModalProps {
  onSuccess?: () => void;
}

const NotificationEmailModal: React.FC<NotificationEmailModalProps> = ({ onSuccess }) => {
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
  } = useEmailManagement(() => {
    // On success, call the provided callback
    if (onSuccess) {
      onSuccess();
    }
  }, 'email');

  const currentStep = step === 'existing' ? 'email' : step;

  // Track when email modal is shown
  useEffect(() => {
    track(TRACKING_EVENTS.EMAIL_ENTRY_STARTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      context: 'notification',
      has_existing_email: !!user?.email,
    });
  }, [user?.userId, user?.safeAddress, user?.email]);


  return (
    <View className="flex-1 gap-4">
      <View className="items-center">
        <Image
          source={require('@/assets/images/email.png')}
          style={{ width: 144, height: 144 }}
          resizeMode="contain"
        />
      </View>

      <View className="items-center gap-2 mt-4">
        <Text className="text-2xl font-bold text-center">
          {currentStep === 'email' ? 'Email required' : 'Verify your email'}
        </Text>
        <Text
          className={cn(
            'text-muted-foreground text-center font-medium',
            currentStep === 'email' ? 'max-w-sm' : 'max-w-xs',
          )}
        >
          {currentStep === 'email'
            ? 'To receive notifications by email, we need your email address.'
            : `Enter the 6-digit verification code sent to your email address:\n${emailValue}`}
        </Text>
      </View>

      {currentStep === 'email' && (
        <Text className="text-muted-foreground text-center font-medium max-w-[23rem]">
          This email will also be used for account recovery if you lose access to your passkey.
        </Text>
      )}

      {rateLimitError && (
        <View className="p-2.5 border border-red-300 rounded-2xl">
          <Text className="text-red-400 text-sm text-center">{rateLimitError}</Text>
        </View>
      )}

      <View className="gap-4 mt-6">
        {currentStep === 'email' ? (
          <View className="gap-2">
            <Text className="font-medium text-muted-foreground">Email Address</Text>
            <Controller
              control={emailForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => {
                const InputComponent = Platform.OS === 'web' ? TextInput : BottomSheetTextInput;
                return (
                  <InputComponent
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    className="h-14 px-6 bg-accent rounded-xl text-lg text-foreground font-semibold web:focus:outline-none"
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
                <Pressable onPress={handleResendOtp} disabled={isLoading} className="group">
                  <Text className="text-sm underline group-hover:opacity-70">
                    Resend verification code
                  </Text>
                </Pressable>
              )}
            </View>
            <Controller
              key="otp-input"
              control={otpForm.control}
              name="otpCode"
              render={({ field: { onChange, onBlur, value } }) => {
                const InputComponent = Platform.OS === 'web' ? TextInput : BottomSheetTextInput;
                return (
                  <InputComponent
                    placeholder="123456"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="numeric"
                    maxLength={6}
                    className="h-14 px-6 bg-accent rounded-xl text-lg text-foreground font-semibold web:focus:outline-none"
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
            className="rounded-2xl h-14"
          >
            <Text className="text-lg font-semibold">{getButtonText()}</Text>
            {isLoading && <ActivityIndicator color="gray" />}
          </Button>

          {currentStep === 'otp' && (
            <Button
              onPress={handleEmailBack}
              variant="outline"
              disabled={isLoading}
              className="rounded-2xl h-14 border-0"
            >
              <Text className="text-lg font-semibold">Back to Email</Text>
            </Button>
          )}

        </View>
      </View>
    </View>
  );
};

export default NotificationEmailModal;
