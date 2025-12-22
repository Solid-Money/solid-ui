import LoginKeyIcon from '@/assets/images/login_key_icon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

import { DesktopCarousel, OnboardingPage, OnboardingPagination } from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { getGradientColors, ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';

const { width: screenWidth } = Dimensions.get('window');

export default function Onboarding() {
  const router = useRouter();
  const { handleLogin, handleDummyLogin } = useUser();
  const { users } = useUserStore();
  const { setHasSeenOnboarding } = useOnboardingStore();
  const { isDesktop } = useDimension();
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

    if (users.length > 0) {
      // If users exist, go to welcome screen for user selection
      router.replace(path.WELCOME);
    } else {
      // No users exist, try passkey login or go to signup
      try {
        await handleLogin();
      } catch (error) {
        console.error('Passkey login failed:', error);
        // If no existing users, redirect to signup
        router.replace(path.SIGNUP_EMAIL);
      }
    }
  }, [users.length, handleLogin, router, setHasSeenOnboarding]);

  const handleCreateAccount = useCallback(() => {
    setHasSeenOnboarding(true);
    router.replace(path.SIGNUP_EMAIL);
  }, [router, setHasSeenOnboarding]);

  const handleHelpCenter = useCallback(() => {
    // TODO: Add help center link
    // Linking.openURL(HELP_CENTER_URL);
  }, []);

  // Mobile Layout
  if (!isDesktop) {
    const gradientColors = getGradientColors(currentIndex);

    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1">
          <View className="flex-1">
            {/* Top section - Animation and Title (70%) */}
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

            {/* Bottom section - Dots and Buttons (30%) */}
            <View style={{ flex: 0.3 }} className="justify-between px-6 pb-8">
              {/* Pagination dots */}
              <View className="pt-2">
                <OnboardingPagination data={ONBOARDING_DATA} currentIndex={currentIndex} />
              </View>

              {/* Bottom buttons */}
              <View className="gap-3">
                <Button variant="brand" className="rounded-xl h-14" onPress={handleCreateAccount}>
                  <Text className="text-lg font-bold">Create account</Text>
                </Button>

                {/* OR Divider */}
                <View className="flex-row items-center gap-4">
                  <View className="flex-1 h-[1px] bg-white/20" />
                  <Text className="text-white/50 text-sm">OR</Text>
                  <View className="flex-1 h-[1px] bg-white/20" />
                </View>

                <Button
                  variant="ghost"
                  className="bg-white/15 rounded-xl h-14"
                  onPress={handleLoginPress}
                >
                  <Text className="text-lg font-bold">Login</Text>
                </Button>

                {/* Dev-only Dummy Login */}
                {__DEV__ && (
                  <Button
                    variant="ghost"
                    className="bg-red-500/20 border border-red-500/50 rounded-xl h-10 mt-2"
                    onPress={handleDummyLogin}
                  >
                    <Text className="text-red-400 text-sm font-medium">🛠 Dev: Skip Auth</Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Desktop Layout - Split Screen
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Left Section - Interactive Carousel */}
      <DesktopCarousel onHelpCenterPress={handleHelpCenter} />

      {/* Right Section - Auth Options (70%) */}
      <View className="flex-1 justify-center items-center px-8">
        <View className="w-full max-w-[400px] items-center">
          {/* Solid Logo */}
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 48, height: 52 }}
            contentFit="contain"
          />

          {/* Welcome Text */}
          <View className="mt-16 mb-8 items-center">
            <Text className="text-white/60 text-sm font-medium mb-2">Welcome!</Text>
            <Text className="text-white text-3xl semibold text-center mb-3">
              Your Stablecoin Super-app
            </Text>
            <Text className="text-white/60 text-center text-sm max-w-[320px]">
              Earn more than your bank & spend
            </Text>
            <Text className="text-white/60 text-center text-sm max-w-[320px]">
              stables everywhere with a Visa Card
            </Text>
          </View>

          {/* Auth Buttons */}
          <View className="w-full gap-4 mt-4">
            {/* Create Account Button */}
            <Button
              variant="brand"
              className="rounded-xl h-14 w-full"
              onPress={handleCreateAccount}
            >
              <Text className="text-lg font-semibold">Create account</Text>
            </Button>

            {/* OR Divider */}
            <View className="flex-row items-center gap-4 my-2">
              <View className="flex-1 h-[1px] bg-white/10" />
              <Text className="text-white/40 text-sm">OR</Text>
              <View className="flex-1 h-[1px] bg-white/10" />
            </View>

            {/* Login Button */}
            <Button
              variant="secondary"
              className="rounded-xl h-14 w-full border-white/10"
              onPress={handleLoginPress}
            >
              <LoginKeyIcon width={30} height={15} />
              <Text className="text-lg font-semibold ml-2">Login</Text>
            </Button>

            {/* Dev-only Dummy Login */}
            {__DEV__ && (
              <Button
                variant="ghost"
                className="bg-red-500/20 border border-red-500/50 rounded-xl h-10 mt-2"
                onPress={handleDummyLogin}
              >
                <Text className="text-red-400 text-sm font-medium">🛠 Dev: Skip Auth</Text>
              </Button>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
