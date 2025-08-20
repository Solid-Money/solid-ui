import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import { useDepositStore } from '@/store/useDepositStore';

const DepositEmailModal: React.FC = () => {
  const { setModal } = useDepositStore();

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
    // On success, proceed to deposit options
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  }, 'email');

  const currentStep = step === 'existing' ? 'email' : step;

  return (
    <View className="flex-1 gap-8 py-2">
      <View className="items-center">
        <Image
          source={require('@/assets/images/email.png')}
          style={{ width: 100, height: 100 }}
          contentFit="contain"
        />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-center">
          {currentStep === 'email' ? 'Email required' : 'Verify your email'}
        </Text>
        <Text className="text-muted-foreground text-center leading-5 max-w-xs">
          {currentStep === 'email'
            ? 'For your security, we require a verified email address before you can make deposits.'
            : `Enter the 6-digit verification code sent to your email address:\n${emailValue}`}
        </Text>
      </View>

      {currentStep === 'email' && (
        <View className="flex-row gap-2 border border-yellow-300 rounded-2xl p-2.5">
          <View>
            <Image
              source={require('@/assets/images/exclamation-warning.png')}
              style={{ width: 20, height: 20 }}
              contentFit="contain"
            />
          </View>
          <Text className="text-yellow-400 font-bold text-sm">
            This email will be used for account recovery if you lose access to your passkey.
          </Text>
        </View>
      )}

      {rateLimitError && (
        <View className="p-2.5 border border-red-300 rounded-2xl">
          <Text className="text-red-400 text-sm text-center">{rateLimitError}</Text>
        </View>
      )}

      <View className="gap-4">
        {currentStep === 'email' ? (
          <View className="gap-2">
            <Text className="font-medium text-muted-foreground">Email Address</Text>
            <Controller
              control={emailForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="email@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  className="h-14 px-6 bg-accent rounded-xl text-lg text-foreground font-semibold web:focus:outline-none"
                  placeholderTextColor="#666"
                />
              )}
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
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="123456"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="numeric"
                  maxLength={6}
                  className="h-14 px-6 bg-accent rounded-xl text-lg text-foreground font-semibold web:focus:outline-none"
                  placeholderTextColor="#666"
                />
              )}
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

export default DepositEmailModal;
