import LoginKeyIcon from '@/assets/images/login_key_icon';
import { DesktopCarousel } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { eclipseUsername } from '@/lib/utils/utils';
import { useUserStore } from '@/store/useUserStore';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Welcome() {
  const { handleRemoveUsers, handleSelectUserById } = useUser();
  const { users } = useUserStore();
  const router = useRouter();
  const { isDesktop } = useDimension();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const { session } = useLocalSearchParams<{ session: string }>();

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

  const handleSelectUser = useCallback(
    async (userId: string) => {
      setLoadingUserId(userId);
      try {
        await handleSelectUserById(userId);
      } finally {
        setLoadingUserId(null);
      }
    },
    [handleSelectUserById],
  );

  const handleUseAnotherAccount = useCallback(() => {
    router.push(path.ONBOARDING);
  }, [router]);

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="w-full max-w-[440px] items-center">
      {/* Header */}
      <View className="mb-4 items-center">
        <Text className="text-center text-[38px] font-medium text-white md:text-4xl">
          Welcome back
        </Text>
      </View>

      {/* Subtitle */}
      <Text className="mb-8 px-4 text-center text-base font-normal text-white/60">
        Please select your account to continue, you will be asked to login with your passkey.
      </Text>

      {/* User List */}
      {!users.length ? (
        <Skeleton className="mb-4 h-14 w-full rounded-xl bg-primary/10" />
      ) : (
        <View className="mb-4 w-full gap-3">
          {users.map(user => (
            <Button
              key={user.userId}
              variant="brand"
              className="h-14 justify-between rounded-xl border-0 px-6"
              onPress={() => handleSelectUserById(user.userId)}
              disabled={loadingUserId !== null}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-semibold">
                  {eclipseUsername(user.username || user.email || '', 20)}
                </Text>
              </View>
              <View className="opacity-60">
                <LoginKeyIcon color="#000" />
              </View>
            </Button>
          ))}
        </View>
      )}

      {/* Use another account button */}
      <Button
        variant="secondary"
        onPress={handleUseAnotherAccount}
        className="mb-6 h-14 w-full rounded-xl border-0"
      >
        <Text className="text-base font-semibold text-white">Use another account</Text>
      </Button>

      {/* Forget all users */}
      {users.length > 0 && (
        <Button variant="ghost" className="h-14 rounded-xl" onPress={handleRemoveUsers}>
          <Text className="text-base font-bold text-muted-foreground">Forget all users</Text>
        </Button>
      )}
    </View>
  );

  // Mobile Layout
  if (!isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-background text-foreground">
        <View className="flex-1 px-6">
          {/* Logo at top */}
          <View className="items-center pb-16 pt-8">
            <Image
              source={require('@/assets/images/solid-logo-4x.png')}
              alt="Solid logo"
              style={{ width: 40, height: 44 }}
              contentFit="contain"
            />
          </View>

          {/* Content centered */}
          <View className="flex-1 justify-center pb-8">{formContent}</View>
        </View>
      </SafeAreaView>
    );
  }

  // Desktop Layout - Split Screen
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Left Section - Interactive Carousel */}
      <DesktopCarousel />

      {/* Right Section - Form (70%) */}
      <View className="relative flex-1">
        {/* Logo at top center */}
        <View className="absolute left-0 right-0 top-6 items-center">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 40, height: 44 }}
            contentFit="contain"
          />
        </View>

        {/* Form Content */}
        <View className="flex-1 items-center justify-center px-8">{formContent}</View>
      </View>
    </View>
  );
}
