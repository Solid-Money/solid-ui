import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import { BackButton } from '@/components/ui/back-button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { type AssetPath, getAsset } from '@/lib/assets';
import { VaultType } from '@/lib/types';

import { formatApyLabel } from './savingsVaultData';

const VAULT_HERO_CONTENT: Record<
  VaultType,
  {
    title: string;
    background: AssetPath;
    desktopContentPosition: ImageContentPosition;
  }
> = {
  [VaultType.USDC]: {
    title: 'USD Yield',
    background: 'images/savings-usd-hero-background.jpg',
    desktopContentPosition: 'center',
  },
  [VaultType.ETH]: {
    title: 'ETH Yield',
    background: 'images/savings-eth-hero-background.jpg',
    desktopContentPosition: { left: '50%', top: '58%' },
  },
  [VaultType.FUSE]: {
    title: 'FUSE Yield',
    background: 'images/savings-fuse-hero-background.jpg',
    desktopContentPosition: { left: '50%', top: '58%' },
  },
};

interface SavingsVaultHeroProps {
  vaultType: VaultType;
  apy: number;
  isApyLoading: boolean;
  onHelpPress: () => void;
}

/** Figma 24766:4744 — banknote hero for a single yield vault. */
const SavingsVaultHero = ({ vaultType, apy, isApyLoading, onHelpPress }: SavingsVaultHeroProps) => {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDimension();
  const content = VAULT_HERO_CONTENT[vaultType];
  // Match the Wallet / Rewards navbar row: safe-area inset followed by its
  // 16px top padding. The buttons keep their original hero styling.
  const headerTop = insets.top + 16;

  return (
    <View className="relative h-[264px] w-full">
      <View style={styles.banknoteFrame}>
        <Image
          source={getAsset(content.background)}
          contentFit="cover"
          contentPosition={isDesktop ? content.desktopContentPosition : 'center'}
          pointerEvents="none"
          style={styles.banknoteImage}
        />
        <LinearGradient
          colors={['#111111', 'rgba(17,17,17,0)']}
          pointerEvents="none"
          style={styles.topFade}
        />
        <LinearGradient
          colors={['rgba(17,17,17,0)', '#111111']}
          pointerEvents="none"
          style={styles.bottomFade}
        />
      </View>

      <View
        className="absolute left-4 right-4 z-10 flex-row items-center justify-between"
        style={{ top: headerTop }}
      >
        <BackButton fallbackHref="/earn" variant="hero" />
        <HeaderHelpButton
          accessibilityLabel="How savings works"
          onPress={onHelpPress}
          variant="hero"
        />
      </View>

      <Text style={styles.title}>{content.title}</Text>

      <View style={styles.apyPill}>
        {isApyLoading ? (
          <Skeleton className="h-[18px] w-[64px] rounded-full bg-white/10" />
        ) : (
          <Text style={styles.apyText}>{formatApyLabel(apy, false)} APY</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  apyPill: {
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    left: '50%',
    minWidth: 110,
    paddingHorizontal: 15,
    position: 'absolute',
    top: 229,
    transform: [{ translateX: -55 }],
  },
  apyText: {
    color: '#94F27F',
    fontFamily: 'MonaSans_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  banknoteFrame: {
    backgroundColor: '#323232',
    borderRadius: 20,
    height: 233,
    left: '-6%',
    overflow: 'hidden',
    position: 'absolute',
    top: -4,
    width: '112%',
  },
  banknoteImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomFade: {
    bottom: 0,
    height: 76,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'MonaSans_500Medium',
    fontSize: 30,
    fontWeight: '500',
    left: 0,
    letterSpacing: -1,
    lineHeight: 32,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 173,
  },
  topFade: {
    height: 74,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default SavingsVaultHero;
