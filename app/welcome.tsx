import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function Welcome() {
  const { handleRemoveUsers, handleSelectUserById } = useUser();
  const { users } = useUserStore();
  const router = useRouter();
  const { isDesktop } = useDimension();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const handleSelectUser = async (userId: string) => {
    setLoadingUserId(userId);
    try {
      await handleSelectUserById(userId);
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleUseAnotherAccount = () => {
    router.push(path.ONBOARDING);
  };

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="w-full max-w-[440px] items-center">
      {/* Header */}
      <View className="mb-4 items-center">
        <Text className="text-white text-[38px] md:text-4xl font-medium text-center">
          Welcome back
        </Text>
      </View>

      {/* Subtitle */}
      <Text className="text-white/60 text-center text-base font-normal mb-8 px-4">
        Please select your account to continue, you will be asked to login with your passkey.
      </Text>

      {/* User List */}
      {!users.length ? (
        <Skeleton className="bg-primary/10 rounded-xl h-14 w-full mb-4" />
      ) : (
        <View className="w-full gap-3 mb-4">
          {users.map(user => (
            <Button
              key={user.userId}
              variant="brand"
              className="justify-between rounded-xl h-14 px-6 border-0"
              onPress={() => handleSelectUser(user.userId)}
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
        className="rounded-xl h-14 w-full mb-6 border-0"
      >
        <Text className="text-white text-base font-semibold">Use another account</Text>
      </Button>

      {/* Forget all users */}
      {users.length > 0 && (
        <Button variant="ghost" className="rounded-xl h-14" onPress={handleRemoveUsers}>
          <Text className="text-base font-bold text-muted-foreground">Forget all users</Text>
        </Button>
      )}
    </View>
  );

  // Mobile Layout
  if (!isDesktop) {
    return (
      <SafeAreaView className="bg-background text-foreground flex-1">
        <View className="flex-1 px-6">
          {/* Logo at top */}
          <View className="items-center pt-8 pb-16">
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
      <View className="flex-1 relative">
        {/* Logo at top center */}
        <View className="absolute top-6 left-0 right-0 items-center">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 40, height: 44 }}
            contentFit="contain"
          />
        </View>

        {/* Form Content */}
        <View className="flex-1 justify-center items-center px-8">{formContent}</View>
      </View>
    </View>
  );
}
