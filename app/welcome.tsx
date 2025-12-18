import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PasskeySvg from '@/assets/images/passkey-svg';
import { DesktopCarousel } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useUserStore } from '@/store/useUserStore';

export default function Welcome() {
  const { handleRemoveUsers, handleSelectUserById } = useUser();
  const { users } = useUserStore();
  const router = useRouter();
  const { isDesktop } = useDimension();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Get the first (most recent) user - we display one at a time
  const selectedUser = users.find(u => u.selected) || users[0];

  const handleUnlockWithPasskey = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    setSelectedUserId(selectedUser.userId);

    try {
      await handleSelectUserById(selectedUser.userId);
    } finally {
      setIsLoading(false);
      setSelectedUserId(null);
    }
  };

  const handleUseAnotherAccount = () => {
    router.push(path.SIGNUP_EMAIL);
  };

  const handleBack = () => {
    router.replace(path.ONBOARDING);
  };

  // Form content (shared between mobile and desktop)
  const formContent = (
    <View className="w-full max-w-[400px] items-center">
      {/* Back button - positioned above form on desktop */}
      {isDesktop && (
        <Pressable
          onPress={handleBack}
          className="self-start w-10 h-10 rounded-full bg-white/10 items-center justify-center web:hover:bg-white/20 mb-6"
        >
          <ArrowLeft size={20} color="#ffffff" />
        </Pressable>
      )}

      {/* Passkey Icon */}
      <PasskeySvg />

      {/* Header */}
      <View className="mt-8 mb-4 items-center">
        <Text className="text-white text-3xl font-bold text-center">Welcome back!</Text>
      </View>

      {/* User email display */}
      {!users.length ? (
        <Skeleton className="bg-primary/10 rounded-xl h-6 w-48 mb-8" />
      ) : (
        <Text className="text-white/60 text-center text-lg mb-8">
          {selectedUser?.email || selectedUser?.username}
        </Text>
      )}

      {/* Unlock with Passkey Button */}
      <Button
        variant="brand"
        onPress={handleUnlockWithPasskey}
        disabled={isLoading || !selectedUser}
        className="rounded-xl h-14 w-full mb-6"
      >
        <KeyRound size={20} color="#ffffff" />
        <Text className="text-lg font-semibold ml-2">
          {isLoading ? 'Unlocking...' : 'Unlock with Passkey'}
        </Text>
        {isLoading && <ActivityIndicator color="gray" className="ml-2" />}
      </Button>

      {/* Not you? Use another account */}
      <View className="flex-row items-center gap-1">
        <Text className="text-white/60">Not you?</Text>
        <Pressable onPress={handleUseAnotherAccount}>
          <Text className="text-brand font-semibold">Use another account</Text>
        </Pressable>
      </View>

      {/* Forget all users (less prominent) */}
      {users.length > 0 && (
        <Pressable onPress={handleRemoveUsers} className="mt-6">
          <Text className="text-white/40 text-sm">Forget all users</Text>
        </Pressable>
      )}
    </View>
  );

  // Mobile Layout
  if (!isDesktop) {
    return (
      <SafeAreaView className="bg-background text-foreground flex-1">
        <View className="flex-1">
          {/* Header with back button */}
          <View className="flex-row items-center px-4 py-3">
            <Pressable onPress={handleBack} className="p-2">
              <ChevronLeft size={24} color="#ffffff" />
            </Pressable>
          </View>

          {/* Content */}
          <View className="flex-1 justify-center px-6 pb-8">
            {/* Logo */}
            <View className="items-center mb-8">
              <Image
                source={require('@/assets/images/solid-logo-4x.png')}
                alt="Solid logo"
                style={{ width: 48, height: 52 }}
                contentFit="contain"
              />
            </View>

            {formContent}
          </View>
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
