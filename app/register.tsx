import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { Status } from '@/lib/types';
import { detectAndSaveReferralCode } from '@/lib/utils/referral';
import { useUserStore } from '@/store/useUserStore';

import InfoError from '@/assets/images/info-error';
import Input from '@/components/ui/input';

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only use letters, numbers, underscores_, or hyphens-.')
    .refine(value => !value.includes(' '), 'Username cannot contain spaces'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { handleLogin, handleDummyLogin, handleSignupStarted } = useUser();
  const { signupInfo, loginInfo, setSignupInfo, setLoginInfo } = useUserStore();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useLocalSearchParams<{ session: string }>();
  // TODO: Add recovery flow
  // const [showRecoveryFlow, setShowRecoveryFlow] = useState(false);

  // Reset signup and login info state when component mounts
  useEffect(() => {
    setSignupInfo({ status: Status.IDLE, message: '' });
    setLoginInfo({ status: Status.IDLE, message: '' });
  }, [setSignupInfo, setLoginInfo]);

  // Detect and save referral code from URL when component mounts
  useEffect(() => {
    try {
      const detectedReferralCode = detectAndSaveReferralCode();
      if (detectedReferralCode) {
        console.warn('Referral code detected from URL:', detectedReferralCode);
      }
    } catch (error) {
      console.warn('Error detecting referral code:', error);
    }
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      username: '',
    },
  });

  const watchedUsername = watch('username');

  // Reset form after successful signup
  useEffect(() => {
    if (signupInfo.status === Status.SUCCESS) {
      reset();
    }
  }, [signupInfo.status, reset]);

  const handleSignupForm = async (data: RegisterFormData) => {
    handleSignupStarted(data.username, code);
  };

  const getSignupButtonText = () => {
    if (signupInfo.status === Status.PENDING) return 'Create account';
    if (!watchedUsername) return 'Create account';
    if (!isValid) return 'Enter valid information';
    return 'Continue';
  };

  const getLoginButtonText = () => {
    if (loginInfo.status === Status.PENDING) return 'Logging in';
    if (loginInfo.status === Status.ERROR) return 'Error logging in';
    return 'Login';
  };

  const getSignupErrorText = useMemo(() => {
    if (errors.username) return errors.username.message;
    if (signupInfo.status === Status.ERROR) return signupInfo.message || 'Error creating account';
    return '';
  }, [errors.username, signupInfo.status, signupInfo.message]);

  const getLoginErrorText = useMemo(() => {
    if (loginInfo.status === Status.ERROR) return loginInfo.message || 'Error logging in';
    return '';
  }, [loginInfo.status, loginInfo.message]);

  // const isSignupDisabled = () => {
  //   return signupInfo.status === Status.PENDING || !isValid || !watchedUsername;
  // };

  useEffect(() => {
    if (session === 'expired') {
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Due to inactivity. Please login again.',
        props: {
          badgeText: '',
        },
      });
    }
  }, [session]);

  // TODO: Add recovery flow
  // const handleRecoverySuccess = (organizationId: string, userId: string) => {
  //   // Handle successful recovery - this would typically redirect to the main app
  //   setShowRecoveryFlow(false);
  //   // You might want to automatically log the user in here
  // };

  // if (showRecoveryFlow) {
  //   return (
  //     <SafeAreaView className="bg-background text-foreground flex-1">
  //       <RecoveryFlow
  //         onRecoverySuccess={handleRecoverySuccess}
  //         onBack={() => setShowRecoveryFlow(false)}
  //       />
  //     </SafeAreaView>
  //   );
  // }

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View className="flex-1 justify-center gap-7 px-4 py-8 w-full max-w-[500px] mx-auto">
        <View className="flex-row items-center gap-5 justify-center">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 74, height: 80 }}
            contentFit="contain"
          />
        </View>
        <View className="gap-[60px]">
          <View className="flex-col gap-2">
            <Text className="text-3xl font-semibold text-center">Welcome!</Text>
            <Text className="text-muted-foreground text-center max-w-[300px] items-center mx-auto">
              {`Please enter a username and click on the "Create account" button`}
            </Text>
          </View>

          <View className="w-full flex-col gap-7">
            <View className="gap-5">
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="username"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Choose a username"
                    error={!!errors.username}
                  />
                )}
              />
              {getSignupErrorText ? (
                <View className="flex-row items-center gap-2">
                  <InfoError />
                  <Text className="text-sm text-red-400">{getSignupErrorText}</Text>
                </View>
              ) : null}
              <Button
                variant="brand"
                onPress={handleSubmit(handleSignupForm)}
                //disabled={isSignupDisabled()}
                className="rounded-xl h-14"
              >
                <Text className="text-lg font-semibold">{getSignupButtonText()}</Text>
                {signupInfo.status === Status.PENDING && <ActivityIndicator color="gray" />}
              </Button>
            </View>

            <View className="flex-row items-center gap-4">
              <View className="flex-1 h-px bg-white/20" />
              <Text className="text-center text-muted-foreground">OR</Text>
              <View className="flex-1 h-px bg-white/20" />
            </View>

            <Button
              onPress={handleLogin}
              disabled={loginInfo.status === Status.PENDING}
              variant="secondary"
              className="rounded-xl h-14 border-0"
            >
              <Text className="text-lg font-semibold">{getLoginButtonText()}</Text>
              {loginInfo.status === Status.PENDING && <ActivityIndicator color="gray" />}
            </Button>
            {getLoginErrorText ? (
              <View className="flex-row items-center gap-2">
                <InfoError />
                <Text className="text-sm text-red-400">{getLoginErrorText}</Text>
              </View>
            ) : null}
            {/* TODO: Add recovery flow */}
            {/* <Button
              onPress={() => setShowRecoveryFlow(true)}
              variant="ghost"
              className="rounded-xl h-12"
            >
              <Text className="text-base font-medium text-muted-foreground">
                Forgot Passkey? Recover Access
              </Text>
            </Button> */}

            {/* TODO: Remove when passkey works */}
            {Platform.OS !== 'web' && __DEV__ && (
              <Button onPress={handleDummyLogin} variant="outline" className="rounded-xl h-14">
                <Text className="text-lg font-semibold">Dummy Login</Text>
              </Button>
            )}

            <Text className="text-sm text-muted-foreground">
              Your Solid Account is secured with a passkey - a safer replacement for passwords.{' '}
              <Link
                href="https://docs.solid.xyz/safety-and-trust/security-and-audits#biometric-passkey-login-via-turnkey"
                target="_blank"
                className="underline hover:opacity-70"
              >
                Learn more
              </Link>
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
