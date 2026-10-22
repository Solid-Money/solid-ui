import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Href, useRouter } from 'expo-router';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { sheetBodyInset } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';
import { Button } from '@/components/ui/button';
import { CIRCULAR_CONTROL_SIZE } from '@/components/ui/circular-control';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import {
  BASE_SPEND_DEPLOYMENT,
  isSpendDeploymentConfigured,
} from '@/constants/spendModuleDeployments';
import { useCardSpendDeployments } from '@/hooks/useEuroSpendEnablement';
import { useRewardsUserData } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { MainCurrency } from '@/lib/types';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useEuroLaunchPopupStore } from '@/store/useEuroLaunchPopupStore';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

const GLOW = getAsset('images/euro-launch/glow.svg');
const EU_BLUE = getAsset('images/euro-launch/eu-blue.svg');
const RINGS_STARS = getAsset('images/euro-launch/rings-stars.svg');
const COIN_RIM = getAsset('images/euro-launch/coin-rim.svg');

/** Figma 29302:10052: the euro artwork starts 54 below the sheet's top edge. */
const SHEET_TOP = 54;
/** Figma 29302:10052: 32 under the terms line to the bottom of the screen. */
const SHEET_BOTTOM = 32;
/** Figma 29302:10058: the close button is centred 54 down and 46 in from the right edge. */
const CLOSE_CENTER_TOP = 54;
const CLOSE_CENTER_RIGHT = 46;

const MAIN_CURRENCY_EURO: Href = {
  pathname: path.CARD_MAIN_CURRENCY as string,
  params: { currency: 'EUR' },
} as Href;

interface EuroLaunchPopupProps {
  /** Only a Wirex card has a main currency, so only a Wirex cardholder is offered euros. */
  isWirexCardholder: boolean;
  /** The saved main currency, or undefined until the card details have answered. */
  mainCurrency: MainCurrency | undefined;
}

/**
 * The euro launch announcement on the wallet screen (Figma 29302:9776, "Popup E").
 *
 * Opens by itself once per user for every Wirex cardholder whose main currency is not Euro.
 * "Switch to Euro" does not switch anything here: it opens the Main currency page with Euro
 * picked, where the first switch still needs the one-time EURC approval.
 *
 * It waits for the wallet screen to settle and for anything else that opens over it — What's
 * New, the card pane, a tier trial offer — so two popups never stack, and closes if the card pane
 * opens over it. It stays away until the backend confirms Base is on and this build has its
 * addresses, since the page it leads to could not otherwise finish the switch.
 */
const EuroLaunchPopup = ({ isWirexCardholder, mainCurrency }: EuroLaunchPopupProps) => {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.userId;
  const [isOpen, setIsOpen] = useState(false);

  const seen = useEuroLaunchPopupStore(state => (userId ? !!state.seen[userId] : true));
  const markSeen = useEuroLaunchPopupStore(state => state.markSeen);
  const isHomeReady = useWhatsNewStore(state => state.isHomeReady);
  const isWhatsNewVisible = useWhatsNewStore(state => state.isVisible);
  const isCardPaneOpen = useCardPaneStore(state => state.isOpen);
  const { data: rewards } = useRewardsUserData();
  const { data: spendDeployments } = useCardSpendDeployments();

  const baseDeployment = spendDeployments?.deployments.find(
    deployment => deployment.chainId === BASE_SPEND_DEPLOYMENT.chainId,
  );
  // Only once the backend has said Base is on: an unanswered query must not open the popup and
  // spend the user's one showing on a page that may not be able to finish the switch.
  const euroAvailable =
    isSpendDeploymentConfigured(BASE_SPEND_DEPLOYMENT) && baseDeployment?.available === true;

  const shouldOpen =
    !!userId &&
    !seen &&
    isWirexCardholder &&
    !!mainCurrency &&
    mainCurrency !== 'EUR' &&
    euroAvailable &&
    isHomeReady &&
    !isWhatsNewVisible &&
    !isCardPaneOpen &&
    // Rewards must have answered before "no pending trial" means anything: the trial offer opens
    // itself on the same screen, and the two must not stack.
    !!rewards &&
    !rewards.pendingTierTrial;

  useEffect(() => {
    if (!shouldOpen || !userId) return;
    // Marked as it opens, not on dismissal: closing the app instead of answering has still shown
    // it, and an announcement that came back on every launch until tapped would be a nag.
    markSeen(userId);
    setIsOpen(true);
  }, [shouldOpen, userId, markSeen]);

  // The card pane can open over the wallet screen without a tap on it — `/?screen=card-info` from
  // a notification — and the sheet must not sit on top of it.
  useEffect(() => {
    if (isCardPaneOpen) setIsOpen(false);
  }, [isCardPaneOpen]);

  const close = () => setIsOpen(false);

  const handleSwitch = () => {
    setIsOpen(false);
    router.push(MAIN_CURRENCY_EURO);
  };

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      contentKey="euro-launch"
      designTop={SHEET_TOP}
      designBottom={SHEET_BOTTOM}
    >
      {({ topPadding, presentation }) => {
        const inset = sheetBodyInset(presentation);
        const closeOffset = CIRCULAR_CONTROL_SIZE / 2;

        return (
          <View style={[styles.body, { paddingTop: topPadding, paddingHorizontal: inset }]}>
            <SheetIconButton
              icon="close"
              accessibilityLabel="Close"
              onPress={close}
              style={
                presentation === 'modal'
                  ? styles.closeModal
                  : {
                      position: 'absolute',
                      // `topPadding` is where the artwork starts, wherever the handle left it.
                      top: topPadding - (SHEET_TOP - CLOSE_CENTER_TOP) - closeOffset,
                      right: CLOSE_CENTER_RIGHT - closeOffset,
                      zIndex: 1,
                    }
              }
            />

            <View style={styles.hero}>
              <View style={styles.artwork}>
                <Image source={GLOW} style={styles.glow} contentFit="contain" />
                <Image source={EU_BLUE} style={styles.euBlue} contentFit="contain" />
                <Image source={RINGS_STARS} style={styles.ringsStars} contentFit="contain" />
                <Image source={COIN_RIM} style={styles.coinRim} contentFit="contain" />
                <View style={styles.euroSign}>
                  <Text className="text-[48px] font-semibold text-white">€</Text>
                </View>
              </View>
            </View>

            <View style={styles.chip}>
              <Text className="text-[13px] font-semibold text-[#94F27F]">New</Text>
            </View>

            <Text
              className="mt-px text-center text-[30px] font-semibold leading-[36px] text-white"
              accessibilityRole="header"
            >
              {'Pay in euros.\nNo FX fees.'}
            </Text>

            <Text
              className="mt-3 text-center text-[16px] leading-[22px] text-[#A1A1A1]"
              style={styles.description}
            >
              See your balance in euros and pay straight from your EURC.
            </Text>

            <Button
              variant="brand"
              onPress={handleSwitch}
              accessibilityLabel="Switch to Euro"
              className="mt-6 h-12 gap-3 self-stretch rounded-full px-6"
            >
              <Text className="text-[16px] font-bold leading-[22px] text-black">
                Switch to Euro
              </Text>
              <Text className="text-[16px] font-bold leading-[20px] text-black">→</Text>
            </Button>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={close}
              className="mt-2 h-11 items-center justify-center self-stretch web:hover:opacity-70"
            >
              <Text className="text-[14px] font-medium leading-5 text-[#A1A1A1]">Not now</Text>
            </Pressable>

            <Text className="mt-1 text-center text-[12px] leading-4 text-[#A1A1A1]">
              Uses your EURC balance. You can switch back anytime.
            </Text>
          </View>
        );
      }}
    </CardBottomSheet>
  );
};

// Each SVG keeps its exported size; the offsets place it where Figma draws it on the 168×160
// artwork frame, including the bleed its blur or shadow adds around the shape.
const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  closeModal: { position: 'absolute', right: 0, top: 0, zIndex: 1 },
  // Figma 29302:10061: 166 tall and clipped, so the glow and shadow fade out under the chip.
  hero: { alignItems: 'center', alignSelf: 'stretch', height: 166, overflow: 'hidden' },
  artwork: { height: 160, width: 168 },
  // Figma 29302:10062: a 240×120 glow at (-36, 25), with 34 of blur on every side.
  glow: { height: 188, left: -70, position: 'absolute', top: -9, width: 308 },
  // Figma 29302:10146: the 158 disc at (5, 1), with its drop shadow around it.
  euBlue: { height: 214, left: -23, position: 'absolute', top: -15, width: 214 },
  ringsStars: { height: 160, left: 0, position: 'absolute', top: 0, width: 168 },
  coinRim: { height: 78, left: 45, position: 'absolute', top: 41, width: 78 },
  // The € sits on the coin rim's centre, which is the artwork's centre.
  euroSign: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // Figma 29302:10056: 17 under the hero.
  chip: {
    backgroundColor: 'rgba(148, 242, 127, 0.14)',
    borderRadius: 100,
    height: 32,
    justifyContent: 'center',
    marginTop: 17,
    paddingLeft: 13,
    paddingRight: 12,
  },
  description: { maxWidth: 294 },
});

export default EuroLaunchPopup;
