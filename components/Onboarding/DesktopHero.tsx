import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { useLandingPageApy } from '@/hooks/useLandingPageApy';
import { getAsset } from '@/lib/assets';

/**
 * Left panel of the desktop onboarding split screen (Figma 907:1203) — the same
 * full-bleed hero the redesigned mobile landing uses, sized for the panel.
 *
 * It replaced `DesktopCarousel` here: one static image and one headline, no slides,
 * no pagination and no drag gesture. The carousel itself stays — the welcome
 * (account-selection) screen still uses it.
 *
 * The headline steps up at `xl`; below that the panel is close to its 280px floor,
 * where the desktop type size would wrap mid-word.
 */
export function DesktopHero() {
  const { apy } = useLandingPageApy();
  // Falls back to 8 while loading or when no APY is configured, so the copy never
  // renders "0%" — same as the mobile landing.
  const apyLabel = apy > 0 ? Number(apy.toFixed(1)) : 8;

  return (
    <View className="m-4 w-[28%] min-w-[280px] max-w-[540px] overflow-hidden rounded-2xl bg-[#111]">
      <Image
        source={getAsset('images/onboarding_hero_bg.png')}
        alt=""
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        contentFit="cover"
      />

      <View className="flex-1 justify-end px-8 pb-12 xl:px-10 xl:pb-14">
        <Text className="text-[36px] font-medium leading-[36px] -tracking-[2px] text-white xl:text-[52px] xl:leading-[52px]">
          Your Money{'\n'}Never Sleeps
        </Text>

        <Text className="mt-4 text-base leading-[1.2] text-white/70 xl:text-[20px]">
          Earn up to {apyLabel}% return on your savings automatically, and spend globally with your
          Solid card, all in one account.
        </Text>
      </View>
    </View>
  );
}
