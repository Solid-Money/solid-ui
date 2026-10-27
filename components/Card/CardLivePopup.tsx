import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { EASE_OUT_QUINT } from '@/components/Card/NewCardDetails/heroMotion';
import ConfettiOverlay from '@/components/SpinAndWin/ConfettiOverlay';
import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { DigitalWalletType } from '@/constants/digital-wallet';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';

/** The brand greens, with a little gold (Figma "Card is live · confetti"). */
const CONFETTI_COLORS = [
  '#94F27F',
  '#FFFFFF',
  '#C7F9B9',
  '#94F27F',
  '#FFFFFF',
  '#C7F9B9',
  '#FFD151',
];
const CONFETTI_COUNT = 34;
/** The burst leaves from behind the card, half a second in, once the card has settled. */
const CONFETTI_DELAY_MS = 500;
const HERO_HEIGHT = 268;
/** Where the card's centre sits in the hero. */
const CARD_CENTRE_Y = 138;
const GLOW_CENTRE_Y = 147;

const WALLET_LABEL: Record<DigitalWalletType, string> = {
  [DigitalWalletType.Apple]: 'Add to Apple Wallet',
  [DigitalWalletType.Google]: 'Add to Google Wallet',
};

type CardLivePopupAction = 'add_funds' | 'add_to_wallet' | 'close';

interface CardLivePopupProps {
  isOpen: boolean;
  onClose: () => void;
  /** The new card's last four digits, for the "Visa Platinum · •••• 6483" pill. */
  last4?: string;
  /** Opens the deposit flow. Omitted where funds cannot be added, which hides the button. */
  onAddFunds?: () => void;
  /** The wallet this device adds cards to; null hides the button (desktop web). */
  wallet: DigitalWalletType | null;
  onAddToWallet: (wallet: DigitalWalletType) => void;
}

/**
 * "Your card is live" (Figma 7 · Card is live): the popup a Wirex card opens with, in place of
 * the Rain welcome popup. The new card settles into a green glow, one burst of confetti goes off,
 * and the two things worth doing next — adding funds and adding the card to the phone's wallet —
 * are one tap away.
 */
const CardLivePopup = ({
  isOpen,
  onClose,
  last4,
  onAddFunds,
  wallet,
  onAddToWallet,
}: CardLivePopupProps) => {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState<number | null>(null);

  const cardOffset = useSharedValue(reduceMotion ? 0 : 14);
  const cardScale = useSharedValue(reduceMotion ? 1 : 0.93);
  const glowOpacity = useSharedValue(reduceMotion ? 1 : 0);

  // Once per open: the entrance and the event, with the flags as they are at that moment.
  const hasEnteredRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasEnteredRef.current = false;
      return;
    }
    if (hasEnteredRef.current) return;
    hasEnteredRef.current = true;

    track(TRACKING_EVENTS.CARD_LIVE_POPUP_SHOWN, {
      has_wallet_action: wallet !== null,
      has_add_funds: Boolean(onAddFunds),
    });

    if (reduceMotion) return;
    // Reset on every open, so a second open plays the same entrance.
    cardOffset.value = 14;
    cardScale.value = 0.93;
    glowOpacity.value = 0;
    const settle = { duration: 620, easing: EASE_OUT_QUINT };
    cardOffset.value = withDelay(120, withTiming(0, settle));
    cardScale.value = withDelay(120, withTiming(1, settle));
    glowOpacity.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT_QUINT }));
  }, [isOpen, reduceMotion, wallet, onAddFunds, cardOffset, cardScale, glowOpacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardOffset.value }, { scale: cardScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const finish = (action: CardLivePopupAction) => {
    track(TRACKING_EVENTS.CARD_LIVE_POPUP_ACTION, { action });
    onClose();
  };

  const handleAddFunds = () => {
    finish('add_funds');
    onAddFunds?.();
  };

  const handleAddToWallet = () => {
    if (!wallet) return;
    finish('add_to_wallet');
    onAddToWallet(wallet);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && finish('close')}>
      <DialogContent
        showCloseButton={false}
        className="w-[90vw] max-w-[351px] gap-0 overflow-hidden p-0"
        style={styles.popup}
      >
        <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
          <View style={styles.hero}>
            <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
              {/* The round radial glow, stretched into the hero's ellipse. */}
              <Image
                source={getAsset('images/region-unavailable-glow.svg')}
                style={StyleSheet.absoluteFill}
                contentFit="fill"
              />
            </Animated.View>
            <Animated.View style={[styles.card, cardStyle]}>
              <Image
                source={getAsset('images/card-waiting-hero.png')}
                alt="Your Solid card"
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            </Animated.View>
            <LinearGradient
              colors={['rgba(22,22,22,0)', '#161616']}
              style={styles.fade}
              pointerEvents="none"
            />
            <DialogCloseButton className="absolute right-4 top-4 z-10 bg-white/10" />
          </View>

          <View className="items-center gap-2.5 px-6 pt-0.5">
            {last4 ? (
              <View
                className="flex-row items-center gap-1.5 rounded-[14px] py-[5px] pl-2.5 pr-3"
                style={styles.pill}
              >
                <View className="h-1.5 w-1.5 rounded-full bg-[#94F27F]" />
                <Text className="text-xs font-medium text-[#94F27F]">
                  Visa Platinum · •••• {last4}
                </Text>
              </View>
            ) : null}
            <Text className="text-[26px] font-semibold text-white">Your card is live</Text>
            <Text className="text-center text-base leading-[22px] text-[#ACACAC]">
              Add funds and start spending. No FX fees on euro and dollar payments.
            </Text>
          </View>

          <View className="w-full gap-2.5 p-6">
            {onAddFunds ? (
              <Button variant="brand" className="h-[52px] rounded-[30px]" onPress={handleAddFunds}>
                <Text className="text-base font-semibold text-black">Add funds</Text>
              </Button>
            ) : (
              <Button
                variant="brand"
                className="h-[52px] rounded-[30px]"
                onPress={() => finish('close')}
              >
                <Text className="text-base font-semibold text-black">Continue</Text>
              </Button>
            )}
            {wallet ? (
              <Button
                variant="secondary"
                className="h-[52px] rounded-[30px] border-0 bg-[#262626]"
                onPress={handleAddToWallet}
              >
                <Text className="text-base font-semibold text-white">{WALLET_LABEL[wallet]}</Text>
              </Button>
            ) : null}
          </View>

          {/* Over everything, so the pieces cross the copy as they fall; measured first, so the
              burst leaves from the card's centre on any width. */}
          {isOpen && width !== null && !reduceMotion ? (
            <ConfettiOverlay
              visible
              colors={CONFETTI_COLORS}
              count={CONFETTI_COUNT}
              burstFrom={{ x: width / 2, y: CARD_CENTRE_Y }}
              delay={CONFETTI_DELAY_MS}
            />
          ) : null}
        </View>
      </DialogContent>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  popup: {
    backgroundColor: '#161616',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    borderWidth: 1,
  },
  hero: {
    backgroundColor: '#0C0C0C',
    height: HERO_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  // Figma's 320×190 glow ellipse, centred a little under the card, with its blur's reach.
  glow: {
    height: 350,
    left: '50%',
    marginLeft: -240,
    position: 'absolute',
    top: GLOW_CENTRE_Y - 175,
    width: 480,
  },
  card: {
    alignSelf: 'center',
    height: 209,
    marginTop: 34,
    maxWidth: '84%',
    width: 292,
  },
  fade: {
    bottom: 0,
    height: 70,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  pill: {
    backgroundColor: 'rgba(148,242,127,0.12)',
  },
});

export default CardLivePopup;
