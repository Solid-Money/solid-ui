import { View } from 'react-native';

import { OnboardingHeroBackground } from '@/components/Onboarding/NewOnboarding/OnboardingHeroBackground';
import { Text } from '@/components/ui/text';

/**
 * Left panel of every desktop split screen — onboarding, welcome, recovery and the
 * signup steps (Figma 20964:5584). Reuses the same full-bleed video and dark scrim
 * as the redesigned mobile landing, with the desktop copy centered over it.
 *
 * It replaced `DesktopCarousel`, which is gone: one looping video and one headline
 * in place of three Lottie slides, gradient crossfades, pagination dots and a drag
 * gesture.
 *
 * The type steps up at `xl` to match the 540px-wide Figma frame while remaining
 * readable near the panel's 280px minimum width.
 */
export function DesktopHero() {
  return (
    <View className="m-4 w-[28%] min-w-[280px] max-w-[540px] overflow-hidden rounded-2xl bg-[#111]">
      <OnboardingHeroBackground />
      <View className="absolute inset-0 bg-black/30" />

      <View className="flex-1 items-center justify-center px-8 pb-12 xl:px-10">
        <Text className="w-full max-w-[430px] text-center text-[36px] font-normal leading-[36px] -tracking-[2px] text-white xl:text-[50px] xl:leading-[50px]">
          The stablecoin money app
        </Text>

        <Text className="mt-6 max-w-[282px] text-center text-base leading-[1.2] text-white/70 xl:text-[18px]">
          A dollar account for anyone, anywhere. Save, earn, and spend globally with your Solid card
        </Text>
      </View>
    </View>
  );
}
