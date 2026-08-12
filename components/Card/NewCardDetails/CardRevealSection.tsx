import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';

import CardDetailsPanel, {
  REVEAL_DURATION,
} from '@/components/Card/NewCardDetails/CardDetailsPanel';
import {
  CARD_BODY_BLEED_PERCENT,
  CARD_BOTTOM_SHADOW_RATIO,
  CARD_TOP_GAP,
  CARD_TOP_SHADOW_RATIO,
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
 * If the reveal request fails the card stays on its front face and the reason is
 * surfaced as a toast, so the toggle can be tried again. It must never flip onto
 * stand-in digits: that reads as a working card the user might try to spend.
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
  const [isRevealFaceWarm, setIsRevealFaceWarm] = useState(false);
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

  // Flip only once real values arrived. Held back by a frame on purpose: the values
  // swap in on the render that the request triggers, and starting the flip and the
  // panel in that same frame is what made the first reveal stutter on Android. A
  // frame is enough for that render to commit first.
  useEffect(() => {
    if (!hasRequested || isLoading || !cardDetails) return;
    const frame = requestAnimationFrame(() => setIsRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [hasRequested, isLoading, cardDetails]);

  // A failed reveal used to flip the card onto Figma's placeholder digits, which
  // looked exactly like a working card. Report it and stay on the front face so the
  // toggle can be tried again.
  useEffect(() => {
    if (!hasRequested || isLoading || !error || cardDetails) return;
    setHasRequested(false);
    Toast.show({
      type: 'error',
      text1: 'Could not show card details',
      text2: error,
      props: { badgeText: '' },
    });
  }, [hasRequested, isLoading, error, cardDetails]);

  // Build the revealed face while the pane sits idle, so the first tap doesn't pay
  // for three pieces of pill artwork decoding and the copy icons rasterising. Runs
  // after interactions so it never competes with the pane's own opening animation,
  // and is never unset — the cost is paid once per session.
  useEffect(() => {
    if (!isPaneOpen || isRevealFaceWarm) return;
    const task = InteractionManager.runAfterInteractions(() => setIsRevealFaceWarm(true));
    return () => task.cancel();
  }, [isPaneOpen, isRevealFaceWarm]);

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
      // Swallowed: the hook surfaces the failure through `error`, which the effect
      // above turns into a toast.
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
      {/* box-none while the pane is open: the artwork's transparent shadow overlaps the
          panel below, so the wrapper must never be a touch target itself — but the copy
          buttons on the revealed face still need to receive taps.

          It has to go back to 'none' when the pane closes. The pane stays mounted and
          laid out (transparent, pointerEvents="none") so it can open instantly, and on
          web `box-none` compiles to `pointer-events: none` on this view plus
          `> * { pointer-events: auto }` — which handed hit-testing back to the invisible
          card and left it swallowing taps aimed at the wallet's balance pill and action
          buttons underneath. */}
      <View
        className="z-10"
        style={styles.cardBody}
        pointerEvents={isPaneOpen ? 'box-none' : 'none'}
      >
        <CardHeroTarget>
          <View style={styles.cardStack}>
            <Animated.View style={frontStyle} pointerEvents="none">
              <NewCardArt last4={last4} />
            </Animated.View>
            {/* Built once the pane has gone idle (see above), or on demand if the tap
                beats that. Never on the wallet screen's own startup path — nobody can
                see this face until the card flips. */}
            {isRevealFaceWarm || hasRequested || isRevealed ? (
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
  // Out past the screen's px-4 and far enough to cancel the shadow the artwork bakes
  // into each side, so the visible card spans the content column rather than sitting
  // inside it. Matches the home card exactly — that identical size is what makes the
  // hero transition read as one card.
  slot: {
    marginHorizontal: `${-CARD_BODY_BLEED_PERCENT}%`,
    marginTop: CARD_TOP_GAP,
    position: 'relative',
  },
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
