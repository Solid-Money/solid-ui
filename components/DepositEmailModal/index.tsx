import { Controller } from 'react-hook-form';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import { cn } from '@/lib/utils';
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
    getButtonText,
    isFormDisabled,
    rateLimitError,
    emailValue,
  } = useEmailManagement(() => {
    // On success, proceed to deposit options
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  }, 'email');

  const handleBack = () => {
    if (step === 'otp') {
      handleEmailBack();
    } else {
      setModal(DEPOSIT_MODAL.CLOSE);
    }
  };

  const currentStep = step === 'existing' ? 'email' : step;

  return (
    <View className="flex-1 px-6 py-8">
      <View className="mb-8 items-center">
        <View className="w-16 h-16 bg-yellow-100 rounded-full mb-4 items-center justify-center">
          <Text className="text-2xl">{currentStep === 'email' ? '🔒' : '📧'}</Text>
        </View>
        <Text className="text-2xl font-bold text-center mb-4">
          {currentStep === 'email' ? 'Email Required for Deposits' : 'Verify Your Email'}
        </Text>
        <Text className="text-gray-600 text-center mb-2">
          {currentStep === 'email'
            ? 'For your security, we require a verified email address before you can make deposits.'
            : 'Enter the 6-digit verification code sent to your email address.'}
        </Text>
        {currentStep === 'email' && (
          <Text className="text-gray-500 text-center text-sm">
            This email will also serve as your account recovery method if you lose your passkey.
          </Text>
        )}
        {currentStep === 'otp' && (
          <Text className="text-gray-500 text-center text-sm">Sent to: {emailValue}</Text>
        )}
      </View>

      {rateLimitError && (
        <View className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <Text className="text-red-600 text-sm text-center">{rateLimitError}</Text>
        </View>
      )}

      <View className="mb-6">
        {currentStep === 'email' ? (
          <>
            <Text className="font-medium mb-2 text-foreground">Email Address</Text>
            <Controller
              control={emailForm.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="Enter your email address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  className={cn(
                    'h-14 px-6 rounded-xl border text-lg font-semibold placeholder:text-muted-foreground mb-4',
                    'border-border bg-background text-foreground',
                  )}
                  placeholderTextColor="#9CA3AF"
                />
              )}
            />
          </>
        ) : (
          <>
            <Text className="font-medium mb-2 text-foreground">Verification Code</Text>
            <Controller
              key="otp-input"
              control={otpForm.control}
              name="otpCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="Enter 6-digit code"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="numeric"
                  maxLength={6}
                  className={cn(
                    'h-14 px-6 rounded-xl border text-lg font-semibold placeholder:text-muted-foreground mb-4 text-center',
                    'border-border bg-background text-foreground',
                  )}
                  placeholderTextColor="#666"
                />
              )}
            />
          </>
        )}
      </View>

      <View className="gap-3">
        <Button
          onPress={
            currentStep === 'email'
              ? emailForm.handleSubmit(handleSendOtp)
              : otpForm.handleSubmit(handleVerifyOtp)
          }
          disabled={isFormDisabled()}
          variant="brand"
          className="rounded-xl h-14"
        >
          <Text className="text-white font-semibold">{getButtonText()}</Text>
          {isLoading && <ActivityIndicator color="white" />}
        </Button>

        {currentStep === 'otp' && (
          <Button
            onPress={handleBack}
            variant="outline"
            disabled={isLoading}
            className="rounded-xl h-14"
          >
            <Text className="text-gray-600">Back to Email</Text>
          </Button>
        )}

        <Button
          onPress={handleBack}
          variant="outline"
          disabled={isLoading}
          className="rounded-xl h-14"
        >
          <Text className="text-gray-600">Cancel</Text>
        </Button>
      </View>

      <View className="mt-6 px-4">
        <Text className="text-xs text-gray-500 text-center">
          {currentStep === 'email'
            ? '⚠️ Important: This email will be used for account recovery if you lose access to your passkey.'
            : "Didn't receive the code? Check your spam folder or go back to try a different email."}
        </Text>
      </View>
    </View>
  );
};

export default DepositEmailModal;