import { useRouter } from 'expo-router';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import useUser from '@/hooks/useUser';

export default function Email() {
  const { user } = useUser();
  const router = useRouter();
  
  const {
    step,
    isLoading,
    emailValue,
    rateLimitError,
    emailForm,
    otpForm,
    handleSendOtp,
    handleVerifyOtp,
    handleChangeEmail,
    handleBack: hookHandleBack,
    getButtonText,
    isFormDisabled,
    clearRateLimitError,
  } = useEmailManagement(() => {
    Alert.alert('Success', 'Your email has been successfully updated!', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  });

  const handleBack = () => {
    if (step === 'email' || step === 'otp') {
      hookHandleBack();
    } else {
      router.back();
    }
  };


  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom']}
    >
      <View className="flex-1">
        <ScrollView className="flex-1">
          <View className="w-full max-w-7xl mx-auto px-4 py-8">
            <Text className="text-sm text-muted-foreground font-medium mb-8">
              {step === 'existing'
                ? 'Your current email address is used for notifications and wallet recovery.'
                : step === 'email'
                  ? 'Enter the email address we should use to notify you of important activity and be used for Wallet funds recovery.'
                  : 'Enter the 6-digit verification code sent to your email address.'}
            </Text>

            {step === 'otp' && (
              <Text className="text-sm text-muted-foreground mb-6">
                Sent to: {emailValue}
              </Text>
            )}

            {rateLimitError && (
              <View className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <View className="flex-row items-center mb-2">
                  <Text className="text-red-600 text-lg mr-2">⏰</Text>
                  <Text className="font-semibold text-red-800">Rate Limit Reached</Text>
                </View>
                <Text className="text-red-700 text-sm leading-5">
                  {rateLimitError}
                </Text>
                <Text className="text-red-600 text-xs mt-2">
                  This is a security measure to prevent spam. You can try again in a few minutes.
                </Text>
                <Button
                  onPress={clearRateLimitError}
                  variant="outline"
                  className="mt-3 h-10 border-red-300"
                >
                  <Text className="text-red-700 text-sm">Try Again</Text>
                </Button>
              </View>
            )}

            {step === 'existing' ? (
              <View className="gap-2">
                <Text className="text-muted-foreground">Current Email</Text>
                <View className="px-5 py-4 bg-accent rounded-2xl">
                  <Text className="text-lg font-semibold text-white">
                    {user?.email}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="gap-2">
                <Text className="text-muted-foreground">
                  {step === 'email' ? 'Email address' : 'Verification Code'}
                </Text>
                <View className="px-5 py-4 bg-accent rounded-2xl">
                  {step === 'email' ? (
                    <Controller
                      key="email-input"
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
                          className="text-lg font-semibold text-white web:focus:outline-none"
                          placeholderTextColor="#666"
                        />
                      )}
                    />
                  ) : (
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
                          className="text-lg font-semibold text-white text-center web:focus:outline-none"
                          placeholderTextColor="#666"
                        />
                      )}
                    />
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View className="px-4 pb-8 gap-3">
          <Button
            variant="brand"
            className="rounded-2xl h-12"
            onPress={
              step === 'existing'
                ? handleChangeEmail
                : step === 'email'
                  ? emailForm.handleSubmit(handleSendOtp)
                  : otpForm.handleSubmit(handleVerifyOtp)
            }
            disabled={isFormDisabled()}
          >
            <Text className="text-lg font-semibold">{getButtonText()}</Text>
            {isLoading && <ActivityIndicator color="white" />}
          </Button>

          <Button
            variant="outline"
            className="rounded-2xl h-12"
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text className="text-muted-foreground font-semibold">
              {step === 'existing' ? 'Back' : step === 'otp' ? 'Back to Email' : 'Cancel'}
            </Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}