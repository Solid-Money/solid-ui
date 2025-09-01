import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import useUser from '@/hooks/useUser';
import { cn } from '@/lib/utils';

export default function Email() {
  const { user } = useUser();
  const router = useRouter();
  const { isDesktop } = useDimension();
  const insets = useSafeAreaInsets();

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
      className="bg-black text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <View className="flex-1">
        <ScrollView className="flex-1">
          {/* Desktop Navbar */}
          {isDesktop && <Navbar />}

          {/* Mobile Header */}
          {!isDesktop && (
            <View className="flex-row items-center justify-between px-4 py-3">
              <Pressable onPress={() => router.back()} className="p-2">
                <ChevronLeft size={24} color="#ffffff" />
              </Pressable>
              <Text className="text-white text-xl font-bold flex-1 text-center mr-10">Email</Text>
            </View>
          )}

          {/* Desktop Header */}
          {isDesktop && (
            <View className="max-w-[512px] mx-auto w-full px-4 pt-8 pb-8">
              <View className="flex-row items-center justify-between mb-8">
                <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
                  <ArrowLeft color="white" />
                </Pressable>
                <Text className="text-3xl font-semibold text-white">Email</Text>
                <View className="w-6" />
              </View>
            </View>
          )}

          <View
            className={cn('w-full mx-auto px-4 py-4', {
              'max-w-[512px]': isDesktop,
              'max-w-7xl': !isDesktop,
            })}
          >
            <Text className="text-sm text-muted-foreground font-medium mb-8">
              {step === 'existing'
                ? 'Your current email address is used for notifications and wallet recovery.'
                : step === 'email'
                  ? 'Enter the email address we should use to notify you of important activity and be used for Wallet funds recovery.'
                  : 'Enter the 6-digit verification code sent to your email address.'}
            </Text>

            {step === 'otp' && (
              <Text className="text-sm text-muted-foreground mb-6">Sent to: {emailValue}</Text>
            )}

            {rateLimitError && (
              <View className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <View className="flex-row items-center mb-2">
                  <Text className="text-red-600 text-lg mr-2">⏰</Text>
                  <Text className="font-semibold text-red-800">Rate Limit Reached</Text>
                </View>
                <Text className="text-red-700 text-sm leading-5">{rateLimitError}</Text>
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
                  <Text className="text-lg font-semibold text-white">{user?.email}</Text>
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

            {/* Desktop buttons - inline with content */}
            {isDesktop && (
              <View className="mt-8 gap-3">
                <Button
                  variant="brand"
                  className="rounded-2xl h-12 w-auto px-8"
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
                  className="rounded-2xl h-12 w-auto px-8"
                  onPress={handleBack}
                  disabled={isLoading}
                >
                  <Text className="text-muted-foreground font-semibold">
                    {step === 'existing' ? 'Back' : step === 'otp' ? 'Back to Email' : 'Cancel'}
                  </Text>
                </Button>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Mobile buttons - at bottom */}
        {!isDesktop && (
          <View
            className="px-4 pt-4 gap-3 bg-black"
            style={{ paddingBottom: insets.bottom + 80 }} // Tab bar height + padding
          >
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
        )}
      </View>
    </SafeAreaView>
  );
}
