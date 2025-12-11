import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';

interface SecurityEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SecurityEmailModalContent: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
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
    if (onSuccess) {
      onSuccess();
    }
  }, 'email');

  const currentStep = step === 'existing' ? 'email' : step;

  useEffect(() => {
    track(TRACKING_EVENTS.EMAIL_ENTRY_STARTED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      context: 'security_settings',
      has_existing_email: !!user?.email,
    });
  }, [user?.userId, user?.safeAddress, user?.email]);

  return (
    <View className="flex-1 gap-4">
      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-center">
          {currentStep === 'email' ? 'Change email' : 'Verify your email'}
        </Text>
        <Text className="text-muted-foreground text-center font-medium text-base max-w-xs">
          {currentStep === 'email'
            ? 'Enter your new email address.'
            : `Enter the 6-digit verification code sent to:\n${emailValue}`}
        </Text>
      </View>

      {rateLimitError && (
        <View className="p-2.5 border border-red-300 rounded-2xl">
          <Text className="text-red-400 text-sm text-center">{rateLimitError}</Text>
        </View>
      )}

      <View className="gap-4 mt-4">
        {currentStep === 'email' ? (
          <View className="gap-2">
            <Text className="font-medium text-muted-foreground">New Email Address</Text>
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

export const SecurityEmailModal: React.FC<SecurityEmailModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  if (Platform.OS === 'web') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Change Email</DialogTitle>
          </DialogHeader>
          <View className="p-6">
            <SecurityEmailModalContent onSuccess={onSuccess} />
          </View>
        </DialogContent>
      </Dialog>
    );
  }

  const modalState = {
    name: 'security-email-modal',
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
      title="Change Email"
      titleClassName="justify-center"
      contentKey="security-email-modal"
    >
      <View className="p-6">
        <SecurityEmailModalContent onSuccess={onSuccess} />
      </View>
    </ResponsiveModal>
  );
};
