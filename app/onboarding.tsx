import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingPage, OnboardingPagination } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';

const { width: screenWidth } = Dimensions.get('window');

export default function Onboarding() {
  const router = useRouter();
  const { handleLogin } = useUser();
  const { users } = useUserStore();
  const { setHasSeenOnboarding } = useOnboardingStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // Derive current index from scroll position
  useDerivedValue(() => {
    const index = Math.round(scrollX.value / screenWidth);
    runOnJS(setCurrentIndex)(index);
  });

  const handleLoginPress = useCallback(async () => {
    // Mark onboarding as seen
    setHasSeenOnboarding(true);

    // If users exist, try passkey login
    if (users.length > 0) {
      try {
        await handleLogin();
      } catch (error) {
        // If login fails, go to register page
        router.replace(path.REGISTER);
      }
    } else {
      // No users exist, go to register page
      router.replace(path.REGISTER);
    }
  }, [users.length, handleLogin, router, setHasSeenOnboarding]);

  const handleCreateAccount = useCallback(() => {
    // Mark onboarding as seen
    setHasSeenOnboarding(true);
    router.replace(path.REGISTER);
  }, [router, setHasSeenOnboarding]);

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View className="flex-1">
        {/* Top section - Animation and Title (60%) */}
        <View style={{ flex: 0.7 }}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            bounces={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {ONBOARDING_DATA.map((item, index) => (
              <OnboardingPage
                key={item.id}
                data={item}
                isActive={currentIndex === index}
                index={index}
              />
            ))}
          </Animated.ScrollView>
        </View>

        {/* Bottom section - Dots and Buttons (40%) */}
        <View style={{ flex: 0.3 }} className="justify-between px-6 pb-8">
          {/* Pagination dots */}
          <View className="pt-2">
            <OnboardingPagination data={ONBOARDING_DATA} currentIndex={currentIndex} />
          </View>

          {/* Bottom buttons */}
          <View className="gap-3">
            <Button variant="brand" className="rounded-xl h-14" onPress={handleLoginPress}>
              <Text className="text-lg font-bold">{users.length > 0 ? 'Login' : 'Login'}</Text>
            </Button>

            <Button variant="ghost" className="rounded-xl h-14" onPress={handleCreateAccount}>
              <Text className="text-lg font-bold">Create Account</Text>
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
