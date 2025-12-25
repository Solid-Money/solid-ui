import LoginKeyIcon from '@/assets/images/login_key_icon';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AnimatedGradientBackground,
  DesktopCarousel,
  OnboardingPage,
  OnboardingPagination,
} from '@/components/Onboarding';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { Status } from '@/lib/types';
import { ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';

export default function Onboarding() {
  const router = useRouter();
  const { handleLogin, handleDummyLogin } = useUser();
  const { setHasSeenOnboarding } = useOnboardingStore();
  const { loginInfo } = useUserStore();
  const { isDesktop } = useDimension();

  const isLoginPending = loginInfo.status === Status.PENDING;
  const { width: screenWidth } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);

  // Track screen width as shared value for use in worklets
  const widthSV = useSharedValue(screenWidth);
  useEffect(() => {
    widthSV.value = screenWidth;
  }, [screenWidth, widthSV]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // Derive current index from scroll position
  useDerivedValue(() => {
    const index = Math.round(scrollX.value / widthSV.value);
    runOnJS(setCurrentIndex)(index);
  });

  const handleLoginPress = useCallback(async () => {
    // Mark onboarding as seen
    setHasSeenOnboarding(true);

    try {
      await handleLogin();
    } catch {
      // If no existing users, redirect to signup
      router.replace(path.SIGNUP_EMAIL);
    }
  }, [handleLogin, router, setHasSeenOnboarding]);

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
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <AnimatedGradientBackground scrollX={scrollX}>
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
                    <OnboardingPage key={item.id} data={item} index={index} scrollX={scrollX} />
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
                    disabled={isLoginPending}
                  >
                    {isLoginPending ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color="white" />
                        <Text className="text-lg font-bold ml-2">Authenticating...</Text>
                      </View>
                    ) : (
                      <Text className="text-lg font-bold">Login</Text>
                    )}
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
        </AnimatedGradientBackground>
      </View>
    );
  }

  // Desktop Layout - Split Screen
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Left Section - Interactive Carousel */}
      <DesktopCarousel onHelpCenterPress={handleHelpCenter} />

      {/* Right Section - Auth Options (70%) */}
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

        {/* Content centered vertically */}
        <View className="flex-1 justify-center items-center px-8">
          <View className="w-full max-w-[440px] items-center">
            {/* Welcome Text */}
            <View className="mb-8 items-center">
              <Text className="text-white/60 text-base font-medium mb-2">Welcome!</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="text-white text-[38px] font-semibold text-center mb-3 -tracking-[1px]"
              >
                Your Stablecoin Super-app
              </Text>
              <Text className="text-white/60 text-center text-base font-normal max-w-[320px]">
                Save, earn yield and pay worldwide -
              </Text>
              <Text className="text-white/60 text-center text-base font-normal max-w-[320px]">
                powered by DeFi, without the complexity
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
                className="rounded-xl h-14 w-full border-0"
                onPress={handleLoginPress}
                disabled={isLoginPending}
              >
                {isLoginPending ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-lg font-semibold ml-2">Authenticating...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <LoginKeyIcon />
                    <Text className="text-lg font-semibold ml-2">Login</Text>
                  </View>
                )}
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
    </View>
  );
}
