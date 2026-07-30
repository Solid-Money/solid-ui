import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';

import CardDetailsPanel, {
  REVEAL_DURATION,
} from '@/components/Card/NewCardDetails/CardDetailsPanel';
import {
  CARD_BOTTOM_SHADOW_RATIO,
  CARD_TOP_GAP,
  CARD_TOP_SHADOW_RATIO,
  CONTENT_PADDING,
} from '@/components/Card/NewCardDetails/cardHeroLayout';
import CardHeroTarget from '@/components/Card/NewCardDetails/CardHeroTarget';
import CardRevealFace from '@/components/Card/NewCardDetails/CardRevealFace';
import { resolveCardRevealValues } from '@/components/Card/NewCardDetails/cardRevealValues';
import { EASE_OUT_EXPO, HERO_ENTER, HeroEnter } from '@/components/Card/NewCardDetails/heroMotion';
import NewCardArt from '@/components/Card/NewCardDetails/NewCardArt';
import { COUNTRIES } from '@/constants/countries';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';
import { CardHolderName, CardProvider } from '@/lib/types';
import { useCardPaneStore } from '@/store/useCardPaneStore';

/** How long a copied card number is allowed to sit on the clipboard. */
const CLIPBOARD_CLEAR_MS = 30_000;

interface CardRevealSectionProps {
  /** Last 4 digits shown on the card's glyph badge before the reveal. */
  last4?: string;
  cardholderName?: CardHolderName;
  provider?: CardProvider | null;
  /** ISO 3166-1 alpha-2 code of the card's issuing country, when known. */
  issuingCountryCode?: string;
}

/**
 * The card plus the panel behind it. Tapping "Show details" fetches the card
 * details, then flips the card to its pill face while the panel slides down to
 * expose the name and issuing country — the two halves of the same gesture, so
 * they share one duration and easing.
 *
 * If the reveal request fails, the design's placeholder values are shown instead of
 * leaving the toggle spinning, so the state is still reachable.
 */
const CardRevealSection = ({
  last4,
  cardholderName,
  provider,
  issuingCountryCode,
}: CardRevealSectionProps) => {
  const { cardDetails, isLoading, error, revealDetails, clearCardDetails } =
    useCardDetailsReveal(provider);
  const isPaneOpen = useCardPaneStore(state => state.isOpen);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const clipboardTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismissing the pane puts the card back to its unrevealed face and drops the
  // revealed numbers — the pane stays mounted between visits, so without this it
  // would reopen mid-reveal and keep the card details in memory (PCI).
  useEffect(() => {
    if (isPaneOpen) return;
    setIsRevealed(false);
    setHasRequested(false);
    clearCardDetails();
  }, [isPaneOpen, clearCardDetails]);

  useEffect(() => {
    return () => {
      if (clipboardTimeout.current) clearTimeout(clipboardTimeout.current);
    };
  }, []);

  // Flip as soon as the request settles — on success with the real values, on
  // failure with the placeholders.
  useEffect(() => {
    if (hasRequested && !isLoading && (cardDetails || error)) {
      setIsRevealed(true);
    }
  }, [hasRequested, isLoading, cardDetails, error]);

  const issuingCountry = useMemo(
    () => COUNTRIES.find(country => country.code === issuingCountryCode)?.name,
    [issuingCountryCode],
  );

  const values = useMemo(
    () => resolveCardRevealValues({ revealed: cardDetails, cardholderName, issuingCountry }),
    [cardDetails, cardholderName, issuingCountry],
  );

  const handleToggle = useCallback(() => {
    if (isRevealed) {
      setIsRevealed(false);
      setHasRequested(false);
      // PCI: don't keep the revealed numbers around once they're off screen.
      clearCardDetails();
      return;
    }
    setHasRequested(true);
    void revealDetails().catch(() => {
      // Swallowed: the hook surfaces the failure through `error`, which flips the
      // card onto the placeholder values.
    });
  }, [isRevealed, revealDetails, clearCardDetails]);

  const copy = useCallback((label: string, value: string, autoClear = false) => {
    void (async () => {
      await Clipboard.setStringAsync(value);
      Toast.show({
        type: 'success',
        text1: `${label} copied`,
        text2: autoClear ? 'Clipboard will clear in 30 seconds' : undefined,
        props: { badgeText: '' },
        visibilityTime: autoClear ? 4000 : 2000,
      });
      if (!autoClear) return;
      if (clipboardTimeout.current) clearTimeout(clipboardTimeout.current);
      clipboardTimeout.current = setTimeout(async () => {
        // Only wipe it if the card number is still what's on the clipboard.
        const current = await Clipboard.getStringAsync().catch(() => null);
        if (current === value) await Clipboard.setStringAsync('').catch(() => {});
      }, CLIPBOARD_CLEAR_MS);
    })();
  }, []);

  // 0 = front (glyph badge), 1 = flipped to the pill face.
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(isRevealed ? 1 : 0, {
      duration: REVEAL_DURATION,
      easing: EASE_OUT_EXPO,
    });
  }, [isRevealed, flip]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    // Starts a half-turn behind the front so it lands face-on at the end.
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180 + 180}deg` }],
  }));

  return (
    <View style={styles.slot}>
      {/* box-none: the artwork's transparent shadow overlaps the panel below, so the
          wrapper must never be a touch target itself — but the copy buttons on the
          revealed face still need to receive taps. */}
      <View className="z-10" style={styles.cardBody} pointerEvents="box-none">
        <CardHeroTarget>
          <View style={styles.cardStack}>
            <Animated.View style={frontStyle} pointerEvents="none">
              <NewCardArt last4={last4} />
            </Animated.View>
            {/* Mounted only once a reveal has been asked for. The back face pulls in
                three pieces of pill artwork, and decoding those while the screen is
                still arriving is enough to stutter the incoming transition — nobody
                can see this face until the card flips anyway. */}
            {hasRequested || isRevealed ? (
              <Animated.View
                style={[styles.cardBack, backStyle]}
                pointerEvents={isRevealed ? 'box-none' : 'none'}
              >
                <NewCardArt
                  overlay={
                    <CardRevealFace
                      values={values}
                      onCopyNumber={() => copy('Card number', values.numberPlain, true)}
                      onCopyExpiry={() => copy('Expiry date', values.expiry)}
                      onCopyCvv={() => copy('Security code', values.cvv)}
                    />
                  }
                />
              </Animated.View>
            ) : null}
          </View>
        </CardHeroTarget>
      </View>
      <HeroEnter spec={HERO_ENTER.showDetails}>
        <CardDetailsPanel
          isRevealed={isRevealed}
          isLoading={isLoading}
          onToggle={handleToggle}
          values={values}
          onCopyName={() => copy('Name on card', values.nameOnCard)}
          onCopyCountry={() => copy('Issuing country', values.issuingCountry)}
        />
      </HeroEnter>
    </View>
  );
};

const styles = StyleSheet.create({
  // Full-bleed past the screen's px-4, matching the home card exactly — that
  // identical size is what makes the hero transition read as one card.
  slot: { marginHorizontal: -CONTENT_PADDING, marginTop: CARD_TOP_GAP, position: 'relative' },
  // Cancelling the artwork's baked-in shadow makes this box exactly the card BODY, so
  // the gap above and the panel tucked in below are measured off the visible card.
  // RN resolves percentage margins against the parent's WIDTH, which is why these
  // are the shadow's share of the card's width rather than its height.
  cardBody: {
    marginBottom: `${-CARD_BOTTOM_SHADOW_RATIO * 100}%`,
    marginTop: `${-CARD_TOP_SHADOW_RATIO * 100}%`,
  },
  cardStack: { position: 'relative' },
  cardBack: { left: 0, position: 'absolute', right: 0, top: 0 },
});

export default CardRevealSection;
