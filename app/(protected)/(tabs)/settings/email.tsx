import { useEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import Checkmark from '@/assets/images/checkmark';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
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

  const hasNavigated = useRef(false);

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
  } = useEmailManagement();

  // Auto-navigate after success state + delay
  useEffect(() => {
    if (step === 'success' && !hasNavigated.current) {
      const timer = setTimeout(() => {
        hasNavigated.current = true;
        router.back();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  const handleBack = () => {
    if (step === 'email' || step === 'otp') {
      hookHandleBack();
    } else {
      router.back();
    }
  };

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable onPress={() => router.back()} className="p-2">
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="mr-10 flex-1 text-center text-xl font-bold text-white">Email</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-3xl font-semibold text-white">Email</Text>
          <View className="w-6" />
        </View>
      </View>
    </>
  );

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      customDesktopHeader={desktopHeader}
      useDesktopBreakpoint
    >
      <View className="flex-1">
        <View
          className={cn('mx-auto w-full px-4 py-4', {
            'max-w-[512px]': isDesktop,
            'max-w-7xl': !isDesktop,
          })}
        >
          {step === 'success' ? (
            <View className="flex-1 items-center justify-center py-12">
              <Checkmark width={120} height={120} color="#94F27F" />
              <Text className="mt-6 text-center text-2xl font-semibold text-white">
                Email verified!
              </Text>
              <Text className="mt-2 text-center text-muted-foreground">{emailValue}</Text>
              <Text className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
                This email will be used for notifications and wallet recovery.
              </Text>
            </View>
          ) : (
            <>
              <Text className="mb-8 text-sm font-medium text-muted-foreground">
                {step === 'existing'
                  ? 'Your current email address is used for notifications and wallet recovery.'
                  : step === 'email'
                    ? 'Enter the email address we should use to notify you of important activity and be used for Wallet funds recovery.'
                    : 'Enter the 6-digit verification code sent to your email address.'}
              </Text>

              {step === 'otp' && (
                <Text className="mb-6 text-sm text-muted-foreground">Sent to: {emailValue}</Text>
              )}

              {rateLimitError && (
                <View className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                  <View className="mb-2 flex-row items-center">
                    <Text className="mr-2 text-lg text-red-600">⏰</Text>
                    <Text className="font-semibold text-red-800">Rate Limit Reached</Text>
                  </View>
                  <Text className="text-sm leading-5 text-red-700">{rateLimitError}</Text>
                  <Text className="mt-2 text-xs text-red-600">
                    This is a security measure to prevent spam. You can try again in a few minutes.
                  </Text>
                  <Button
                    onPress={clearRateLimitError}
                    variant="outline"
                    className="mt-3 h-10 border-red-300"
                  >
                    <Text className="text-sm text-red-700">Try Again</Text>
                  </Button>
                </View>
              )}

              {step === 'existing' ? (
                <View className="gap-2">
                  <Text className="text-muted-foreground">Current Email</Text>
                  <View className="rounded-2xl bg-accent px-5 py-4">
                    <Text className="text-lg font-semibold text-white">{user?.email}</Text>
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <Text className="text-muted-foreground">
                    {step === 'email' ? 'Email address' : 'Verification Code'}
                  </Text>
                  <View className="rounded-2xl bg-accent px-5 py-4">
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
                            className="text-center text-lg font-semibold text-white web:focus:outline-none"
                            placeholderTextColor="#666"
                          />
                        )}
                      />
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Desktop buttons - inline with content */}
          {isDesktop && step !== 'success' && (
            <View className="mt-8 gap-3">
              <Button
                variant="brand"
                className="h-12 w-auto rounded-2xl px-8"
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
                className="h-12 w-auto rounded-2xl px-8"
                onPress={handleBack}
                disabled={isLoading}
              >
                <Text className="font-semibold text-muted-foreground">
                  {step === 'existing' ? 'Back' : step === 'otp' ? 'Back to Email' : 'Cancel'}
                </Text>
              </Button>
            </View>
          )}
        </View>

        {/* Mobile buttons - at bottom */}
        {!isDesktop && step !== 'success' && (
          <View
            className="gap-3 bg-black px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 80 }} // Tab bar height + padding
          >
            <Button
              variant="brand"
              className="h-12 rounded-2xl"
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
              className="h-12 rounded-2xl"
              onPress={handleBack}
              disabled={isLoading}
            >
              <Text className="font-semibold text-muted-foreground">
                {step === 'existing' ? 'Back' : step === 'otp' ? 'Back to Email' : 'Cancel'}
              </Text>
            </Button>
          </View>
        )}
      </View>
    </PageLayout>
  );
}
