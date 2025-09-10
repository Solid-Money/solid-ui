import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { trackSignupInitiated } from '@/lib/gtm';
import { Status } from '@/lib/types';
import { cn } from '@/lib/utils';
import { detectAndSaveReferralCode } from '@/lib/utils/referral';
import { useUserStore } from '@/store/useUserStore';

import InfoError from '@/assets/images/info-error';

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
  const { handleLogin, handleDummyLogin } = useUser();
  const { signupInfo, loginInfo, setSignupInfo, setLoginInfo, setSignupUser } = useUserStore();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useLocalSearchParams<{ session: string }>();
  const router = useRouter();
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

  const handleSignupForm = (data: RegisterFormData) => {
    track(TRACKING_EVENTS.SIGNUP_STARTED, {
      username: data.username,
    });

    // Track signup initiation for Addressable
    trackSignupInitiated({
      username: data.username,
    });

    setSignupUser({ username: data.username, inviteCode: code });
    router.push(path.INVITE);
  };

  const getSignupButtonText = () => {
    if (signupInfo.status === Status.PENDING) return 'Redirecting';
    if (!watchedUsername) return 'Enter a username';
    if (!isValid) return 'Enter valid information';
    return 'Continue';
  };

  const getSignupErrorText = useMemo(() => {
    if (errors.username) return errors.username.message;
    if (signupInfo.status === Status.ERROR) return signupInfo.message || 'Error creating account';
    return '';
  }, [errors.username, signupInfo.status, signupInfo.message]);

  const isSignupDisabled = () => {
    return signupInfo.status === Status.PENDING || !isValid || !watchedUsername;
  };

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
      <View className="flex-1 justify-center gap-10 px-4 py-8 w-full max-w-lg mx-auto">
        <View className="flex-row items-center gap-5">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 37, height: 40 }}
            contentFit="contain"
          />
        </View>
        <View className="gap-8">
          <View className="flex-col gap-2">
            <Text className="text-3xl font-semibold">Welcome!</Text>
            <Text className="text-muted-foreground">
              Invite-only access. Please use a referral from a friend to access the app
            </Text>
          </View>

          <View className="w-full flex-col gap-8">
            <View className="gap-2">
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    id="username"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Choose a username"
                    className={cn(
                      'h-14 px-6 rounded-xl border text-lg text-foreground font-semibold placeholder:text-muted-foreground',
                      errors.username ? 'border-red-500' : 'border-border',
                    )}
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
                disabled={isSignupDisabled()}
                className="rounded-xl h-14"
              >
                <Text className="text-lg font-semibold">{getSignupButtonText()}</Text>
                {signupInfo.status === Status.PENDING && <ActivityIndicator color="gray" />}
              </Button>
            </View>

            <View className="flex-row items-center gap-4">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-center text-muted-foreground">OR</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            <Button
              onPress={handleLogin}
              disabled={loginInfo.status === Status.PENDING}
              variant="secondary"
              className="rounded-xl h-14"
            >
              <Text className="text-lg font-semibold">
                {loginInfo.status === Status.ERROR
                  ? loginInfo.message || 'Error logging in'
                  : loginInfo.status === Status.PENDING
                    ? 'Logging in'
                    : 'Login'}
              </Text>
              {loginInfo.status === Status.PENDING && <ActivityIndicator color="gray" />}
            </Button>
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
          </View>
          <Text className="text-sm text-muted-foreground">
            Your Solid Account is secured with a passkey - a safer replacement for passwords.{' '}
            <Link
              href="https://docs.solid.xyz"
              target="_blank"
              className="underline hover:opacity-70"
            >
              Learn more
            </Link>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
