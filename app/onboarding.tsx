import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import LoginKeyIcon from '@/assets/images/login_key_icon';
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
import { getAsset } from '@/lib/assets';
import { Status } from '@/lib/types';
import { ONBOARDING_DATA } from '@/lib/types/onboarding';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';

export default function Onboarding() {
  const router = useRouter();
  const { handleLogin, handleDummyLogin } = useUser();
  const setHasSeenOnboarding = useOnboardingStore(state => state.setHasSeenOnboarding);
  const { loginInfo } = useUserStore(
    useShallow(state => ({
      loginInfo: state.loginInfo,
    })),
  );
  const { isDesktop } = useDimension();

  const isLoginPending = loginInfo.status === Status.PENDING;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);

  // Responsive layout for small screens (iPhone SE)
  const isSmallScreen = screenHeight < 700;
  // Fixed button area height - content area uses flex: 1 to fill remaining space
  const buttonAreaHeight = isSmallScreen ? 200 : 240;

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
    setCurrentIndex(index);
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

  const filteredOnboardingData = ONBOARDING_DATA.filter(slide => slide?.platform !== false);

  // Mobile Layout
  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <AnimatedGradientBackground scrollX={scrollX}>
          <SafeAreaView className="flex-1">
            <View className="flex-1">
              {/* Top section - Animation and Title (fills remaining space) */}
              <View className="flex-1">
                <Animated.ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                  bounces={false}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  {filteredOnboardingData.map((item, index) => (
                    <OnboardingPage key={item.id} data={item} index={index} scrollX={scrollX} />
                  ))}
                </Animated.ScrollView>
              </View>

              {/* Bottom section - Dots and Buttons (fixed height) */}
              <View
                style={{ height: buttonAreaHeight }}
                className={`justify-between px-6 ${isSmallScreen ? 'pb-4' : 'pb-8'}`}
              >
                {/* Pagination dots */}
                <View className="pt-2">
                  <OnboardingPagination data={filteredOnboardingData} currentIndex={currentIndex} />
                </View>

                {/* Bottom buttons */}
                <View className={isSmallScreen ? 'gap-2' : 'gap-3'}>
                  <Button
                    variant="brand"
                    className={`rounded-xl ${isSmallScreen ? 'h-12' : 'h-14'}`}
                    onPress={handleCreateAccount}
                  >
                    <Text className="native:text-lg text-lg font-bold">Create account</Text>
                  </Button>

                  {/* OR Divider */}
                  <View
                    className={`flex-row items-center gap-4 ${isSmallScreen ? 'my-0' : 'my-1'}`}
                  >
                    <View className="h-[1px] flex-1 bg-white/20" />
                    <Text className="text-sm text-white/50">OR</Text>
                    <View className="h-[1px] flex-1 bg-white/20" />
                  </View>

                  <Button
                    variant="ghost"
                    className={`rounded-xl bg-white/15 ${isSmallScreen ? 'h-12' : 'h-14'}`}
                    onPress={handleLoginPress}
                    disabled={isLoginPending}
                  >
                    {isLoginPending ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color="white" />
                        <Text className="native:text-lg ml-2 text-lg font-bold">
                          Authenticating...
                        </Text>
                      </View>
                    ) : (
                      <Text className="native:text-lg text-lg font-bold">Login</Text>
                    )}
                  </Button>

                  {/* Dev-only Dummy Login */}
                  {/* {__DEV__ && (
                    <Button
                      variant="ghost"
                      className={`bg-red-500/20 border border-red-500/50 rounded-xl ${isSmallScreen ? 'h-8 mt-1' : 'h-10 mt-2'}`}
                      onPress={handleDummyLogin}
                    >
                      <Text
                        className={`text-red-400 font-medium ${isSmallScreen ? 'text-xs' : 'text-sm'}`}
                      >
                        🛠 Dev: Skip Auth
                      </Text>
                    </Button>
                  )} */}
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
      {/* TODO: lazy-loaded for FCP improvement */}
      {/* <LazyDesktopCarousel onHelpCenterPress={handleHelpCenter} /> */}
      <DesktopCarousel onHelpCenterPress={handleHelpCenter} />

      {/* Right Section - Auth Options (70%) */}
      <View className="relative flex-1">
        {/* Logo at top center */}
        <View className="absolute left-0 right-0 top-6 items-center">
          <Image
            source={getAsset('images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 40, height: 44 }}
            contentFit="contain"
          />
        </View>

        {/* Content centered vertically */}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full max-w-[440px] items-center">
            {/* Welcome Text */}
            <View className="mb-8 items-center">
              <Text className="mb-2 text-base font-medium text-white/60">Welcome!</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="mb-3 text-center text-[38px] font-semibold -tracking-[1px] text-white"
              >
                Your Stablecoin Super-app
              </Text>
              <Text className="max-w-[320px] text-center text-base font-normal text-white/60">
                Save, earn yield and pay worldwide -
              </Text>
              <Text className="max-w-[320px] text-center text-base font-normal text-white/60">
                powered by DeFi, without the complexity
              </Text>
            </View>

            {/* Auth Buttons */}
            <View className="mt-4 w-full gap-4">
              {/* Create Account Button */}
              <Button
                variant="brand"
                className="h-14 w-full rounded-xl"
                onPress={handleCreateAccount}
              >
                <Text className="text-lg font-semibold">Create account</Text>
              </Button>

              {/* OR Divider */}
              <View className="my-2 flex-row items-center gap-4">
                <View className="h-[1px] flex-1 bg-white/10" />
                <Text className="text-sm text-white/40">OR</Text>
                <View className="h-[1px] flex-1 bg-white/10" />
              </View>

              {/* Login Button */}
              <Button
                variant="secondary"
                className="h-14 w-full rounded-xl border-0"
                onPress={handleLoginPress}
                disabled={isLoginPending}
              >
                {isLoginPending ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="ml-2 text-lg font-semibold">Authenticating...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <LoginKeyIcon />
                    <Text className="ml-2 text-lg font-semibold">Login</Text>
                  </View>
                )}
              </Button>

              {/* Dev-only Dummy Login */}
              {__DEV__ && (
                <Button
                  variant="ghost"
                  className="mt-2 h-10 rounded-xl border border-red-500/50 bg-red-500/20"
                  onPress={handleDummyLogin}
                >
                  <Text className="text-sm font-medium text-red-400">🛠 Dev: Skip Auth</Text>
                </Button>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
