import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView, BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { DigitalWalletType } from '@/constants/digital-wallet';
import { getAsset } from '@/lib/assets';

interface AddToWalletModalProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialWallet?: DigitalWalletType;
}

interface GuideStep {
  title: string;
  description: string;
  image: Parameters<typeof getAsset>[0];
  imageAspectRatio: number;
}

const MODAL_STATE: ModalState = { name: 'add-to-wallet', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };
const GUIDE_ACTIONS_HEIGHT = 68;
const TOP_FADE_EXTENT = 48;
const WEB_GLASS_BLUR =
  Platform.OS === 'web'
    ? {
        backgroundColor: 'rgba(17, 17, 17, 0.6)',
        backdropFilter: 'saturate(180%) blur(11.2px)',
        WebkitBackdropFilter: 'saturate(180%) blur(11.2px)',
      }
    : undefined;

const APPLE_STEPS: GuideStep[] = [
  {
    title: 'Find Wallet',
    description: 'Open the Wallet app on your iPhone. It’s already built in.',
    image: 'images/wallet-guide/apple-find-wallet.png',
    imageAspectRatio: 326 / 230,
  },
  {
    title: 'Start a new card',
    description: 'Tap the + button, then choose Debit or Credit Card.',
    image: 'images/wallet-guide/apple-start-card.png',
    imageAspectRatio: 326 / 230,
  },
  {
    title: 'Enter your card details',
    description:
      'Choose Enter Card Details Manually. Copy your card number, expiry and CVV from Solid.',
    image: 'images/wallet-guide/apple-card-details.png',
    imageAspectRatio: 326 / 212,
  },
  {
    title: 'Verify and start tapping',
    description:
      'Follow the verification prompts. Once approved, your Solid card is ready for tap to pay.',
    image: 'images/wallet-guide/apple-verify.png',
    imageAspectRatio: 326 / 238,
  },
];

const GOOGLE_STEPS: GuideStep[] = [
  {
    title: 'Open Google Wallet',
    description: 'Open Google Wallet on your Android phone to start adding your Solid card.',
    image: 'images/wallet-guide/google-find-wallet.png',
    imageAspectRatio: 326 / 230,
  },
  {
    title: 'Start a new card',
    description: 'Tap Add to Wallet, then Payment card and New credit or debit card.',
    image: 'images/wallet-guide/google-start-card.png',
    imageAspectRatio: 326 / 230,
  },
  {
    title: 'Enter your card details',
    description:
      'Tap Enter details manually. Copy your card number, expiry and CVV from Solid, then tap Save and continue.',
    image: 'images/wallet-guide/google-card-details.png',
    imageAspectRatio: 326 / 212,
  },
  {
    title: 'Verify and start tapping',
    description:
      'Accept the issuer’s terms and complete verification. Turn on NFC to use tap to pay.',
    image: 'images/wallet-guide/google-verify.png',
    imageAspectRatio: 326 / 230,
  },
];

function WalletTabs({
  activeWallet,
  onChange,
}: {
  activeWallet: DigitalWalletType;
  onChange: (wallet: DigitalWalletType) => void;
}) {
  return (
    <View className="flex-row border-b border-white/10 px-4 pt-5">
      {[
        [DigitalWalletType.Apple, 'Apple Wallet'],
        [DigitalWalletType.Google, 'Google Wallet'],
      ].map(([wallet, label]) => {
        const selected = activeWallet === wallet;
        return (
          <Pressable
            key={wallet}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="relative flex-1 pb-4"
            onPress={() => onChange(wallet as DigitalWalletType)}
          >
            <Text className="text-center text-base font-medium text-white">{label}</Text>
            {selected && (
              <View className="absolute bottom-0 left-[20%] right-[20%] h-1 rounded-full bg-[#94F27F]" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function GuideActions({ wallet, onClose }: { wallet: DigitalWalletType; onClose: () => void }) {
  const isApple = wallet === DigitalWalletType.Apple;
  const supportUrl = isApple
    ? 'https://support.apple.com/en-gb/108398'
    : 'https://support.google.com/wallet/answer/12058983';

  return (
    <View className="mx-auto h-[68px] w-full max-w-[390px] flex-row items-center justify-between px-4">
      <Pressable
        accessibilityLabel="Close wallet guide"
        accessibilityRole="button"
        className="h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80"
        onPress={onClose}
      >
        <ArrowLeft color="white" size={22} />
      </Pressable>
      <Pressable
        accessibilityRole="link"
        className="h-11 items-center justify-center rounded-full bg-[#232323] px-[18px]"
        onPress={() => Linking.openURL(supportUrl)}
      >
        <Text className="text-sm font-semibold text-white">Help</Text>
      </Pressable>
    </View>
  );
}

function GuideHero({ wallet }: { wallet: DigitalWalletType }) {
  const isApple = wallet === DigitalWalletType.Apple;

  return (
    <View className="h-[216px] items-center">
      <Image
        source={getAsset(isApple ? 'images/badge-apple-pay.svg' : 'images/badge-google-pay.svg')}
        contentFit="contain"
        style={{ width: isApple ? 76 : 72, height: 44 }}
      />
      <Text className="mt-[14px] text-center text-[28px] font-medium leading-[34px] text-white">
        {'Add Solid to\n'}
        {isApple ? 'Apple Wallet' : 'Google Wallet'}
      </Text>
      <Text className="mt-2 text-center text-base leading-[22px] text-muted-foreground">
        Set up tap to pay in four simple steps.
      </Text>
      <View className="mt-[10px] flex-row items-center gap-[6px]">
        <View className="h-[7px] w-[7px] rounded-full bg-[#7CED74]" />
        <Text className="text-xs font-medium text-muted-foreground">About 2 minutes</Text>
      </View>
    </View>
  );
}

function StepCard({ step, index }: { step: GuideStep; index: number }) {
  return (
    <View className="gap-[14px] overflow-hidden rounded-[20px] bg-[#1c1c1c] px-4 pb-4 pt-5">
      <View className="h-8 flex-row items-center gap-[10px]">
        <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-white/10">
          <Text className="text-sm font-bold text-white/70">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-lg font-medium leading-6 text-white">{step.title}</Text>
      </View>
      <Text className="text-[15px] leading-[22px] text-muted-foreground">{step.description}</Text>
      <Image
        source={getAsset(step.image)}
        contentFit="contain"
        style={{ width: '100%', aspectRatio: step.imageAspectRatio, borderRadius: 12 }}
      />
    </View>
  );
}

function WalletGuide({
  wallet,
  onClose,
  topInset,
}: {
  wallet: DigitalWalletType;
  onClose: () => void;
  topInset: number;
}) {
  const steps = wallet === DigitalWalletType.Apple ? APPLE_STEPS : GOOGLE_STEPS;
  const blurTargetRef = useRef<View>(null);
  const blurViewProps =
    Platform.OS === 'android'
      ? {
          blurMethod: 'dimezisBlurView' as const,
          blurReductionFactor: 2.4,
          blurTarget: blurTargetRef,
        }
      : {};

  return (
    <View className="flex-1 bg-[#121212]">
      <BlurTargetView ref={blurTargetRef} style={styles.fill}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: topInset + GUIDE_ACTIONS_HEIGHT,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mx-auto w-full max-w-[390px]">
            <GuideHero wallet={wallet} />
            <View className="gap-4 px-4 pt-2">
              {steps.map((step, index) => (
                <StepCard key={step.title} step={step} index={index} />
              ))}
            </View>
          </View>
        </ScrollView>
      </BlurTargetView>
      <View
        pointerEvents="box-none"
        style={[
          styles.glassHeader,
          WEB_GLASS_BLUR,
          { height: topInset + GUIDE_ACTIONS_HEIGHT, paddingTop: topInset },
        ]}
      >
        {Platform.OS !== 'web' && (
          <BlurView
            {...blurViewProps}
            intensity={56}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            tint="systemChromeMaterialDark"
          />
        )}
        {Platform.OS !== 'web' && <View pointerEvents="none" style={styles.glassOverlay} />}
        <GuideActions wallet={wallet} onClose={onClose} />
      </View>
      <LinearGradient
        colors={['rgba(17,17,17,0.6)', 'rgba(17,17,17,0)']}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: topInset + GUIDE_ACTIONS_HEIGHT,
          left: 0,
          right: 0,
          height: TOP_FADE_EXTENT,
          zIndex: 9,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  glassHeader: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
  },
});

export default function AddToWalletModal({
  trigger,
  isOpen,
  onOpenChange,
  initialWallet = DigitalWalletType.Apple,
}: AddToWalletModalProps) {
  const [activeTab, setActiveTab] = useState<DigitalWalletType>(initialWallet);
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const wallet = isWeb
    ? activeTab
    : Platform.OS === 'android'
      ? DigitalWalletType.Google
      : DigitalWalletType.Apple;

  useEffect(() => {
    if (isOpen) setActiveTab(initialWallet);
  }, [isOpen, initialWallet]);

  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
      contentKey={`add-to-wallet-${wallet}`}
      contentClassName="bg-[#121212] p-0 web:max-w-[438px]"
      containerClassName="min-h-0"
      overlayClassName="native:p-0"
      hideHeader
      disableScroll
      fillViewportHeight={isWeb}
      nativeFullScreen
      shouldAnimate={false}
    >
      <View className="flex-1 bg-[#121212]">
        {isWeb && <WalletTabs activeWallet={activeTab} onChange={setActiveTab} />}
        <WalletGuide
          wallet={wallet}
          onClose={() => onOpenChange(false)}
          topInset={isWeb ? 0 : insets.top}
        />
      </View>
    </ResponsiveModal>
  );
}
