import { Pressable, StyleSheet, TextStyle, View } from 'react-native';
import { Image } from 'expo-image';

import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';

const GLOW_ASSET: AssetPath = 'images/rewards-tiers/glow.svg';
const GLOW_SIZE = 300;
const STAR_SIZE = 190;

/** Measured off the design's popup (Figma 25480:2355). */
const EYEBROW_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 12,
  lineHeight: 14,
  letterSpacing: 1.2,
};
const TITLE_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 28,
  lineHeight: 32,
};
const BODY_STYLE: TextStyle = {
  fontFamily: 'MonaSans_400Regular',
  fontSize: 15,
  lineHeight: 20,
};
const STAT_VALUE_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 22,
  lineHeight: 26,
};
const STAT_LABEL_STYLE: TextStyle = {
  fontFamily: 'MonaSans_400Regular',
  fontSize: 12,
  lineHeight: 15,
};
const NOTE_STYLE: TextStyle = {
  fontFamily: 'MonaSans_500Medium',
  fontSize: 14,
  lineHeight: 18,
};
const BUTTON_LABEL_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 16,
  lineHeight: 20,
};
const FOOTNOTE_STYLE: TextStyle = {
  fontFamily: 'MonaSans_400Regular',
  fontSize: 11,
  lineHeight: 14,
};

/** One of the three headline benefits under the title. */
export interface TierPopupStat {
  /** e.g. "4%", "+2%". */
  value: string;
  /** e.g. "Cashback". */
  label: string;
}

export interface TierPopupProps {
  isOpen: boolean;
  /** Whose star to show, and whose benefits the stats describe. */
  tier: RewardsTier;
  /** The small green line above the title, e.g. "TIER UPGRADED". */
  eyebrow: string;
  title: string;
  body: string;
  /** Up to three headline benefits. An empty list hides the row. */
  stats: TierPopupStat[];
  /** The white line under the stats, e.g. "Your 30 days of Prime start now." */
  note?: string;
  primaryLabel: string;
  onPrimary: () => void;
  /** Disables the primary action while a request is in flight. */
  isPrimaryPending?: boolean;
  /** The plain text button under it, e.g. "Done" / "Maybe later". */
  secondaryLabel: string;
  onSecondary: () => void;
  /** The grey line at the very bottom, e.g. "Benefits and monthly limits apply." */
  footnote?: string;
}

/**
 * The tier popup the rewards flows share: a tier's star over its glow, a green
 * eyebrow, a headline, the three benefits that tier grants, and one action.
 *
 * One component rather than one per moment because the design draws them as the
 * same card with different words (Figma 25480:2355 and 25481:2356) — the
 * upgrade celebration, the welcome-offer opt-in and the admin gift are all this
 * card. Keeping them one component is what stops the celebration and the offer
 * drifting apart as either is tweaked.
 *
 * Dismissal always goes through `onSecondary`: the card has no ✕, and tapping
 * the backdrop is the same decision as "Maybe later" — for an offer that means
 * it stays claimable, and for a celebration it just closes.
 */
const TierPopup = ({
  isOpen,
  tier,
  eyebrow,
  title,
  body,
  stats,
  note,
  primaryLabel,
  onPrimary,
  isPrimaryPending = false,
  secondaryLabel,
  onSecondary,
  footnote,
}: TierPopupProps) => (
  <Dialog open={isOpen} onOpenChange={open => !open && onSecondary()}>
    <DialogContent
      showCloseButton={false}
      className="w-[92vw] max-w-[360px] gap-0 border-0 border-none bg-transparent p-0"
    >
      <View className="w-full items-center">
        {/* The star breaks out above the card, so it sits in its own layer
            rather than inside the padded body. */}
        <View className="items-center justify-center" style={{ height: STAR_SIZE * 0.72 }}>
          <Image
            source={getAsset(GLOW_ASSET)}
            contentFit="contain"
            style={[styles.glow, { width: GLOW_SIZE, height: GLOW_SIZE }]}
            pointerEvents="none"
          />
          <TierStar tier={tier} size={STAR_SIZE} />
        </View>

        <View className="w-full items-center rounded-[30px] bg-[#161616] px-6 pb-6 pt-2">
          <Text className="text-center text-brand" style={EYEBROW_STYLE}>
            {eyebrow.toUpperCase()}
          </Text>

          <Text className="mt-3 text-center text-white" style={TITLE_STYLE}>
            {title}
          </Text>

          <Text className="mt-3 text-center text-white/70" style={BODY_STYLE}>
            {body}
          </Text>

          {stats.length > 0 && (
            <View className="mt-6 w-full flex-row">
              {stats.map(stat => (
                <View className="flex-1 items-center" key={stat.label}>
                  <Text className="text-center text-brand" style={STAT_VALUE_STYLE}>
                    {stat.value}
                  </Text>
                  <Text className="mt-1 text-center text-white/50" style={STAT_LABEL_STYLE}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!!note && (
            <Text className="mt-6 text-center text-white" style={NOTE_STYLE}>
              {note}
            </Text>
          )}

          <Button
            variant="brand"
            onPress={onPrimary}
            disabled={isPrimaryPending}
            className="mt-5 h-[50px] w-full rounded-full px-0 py-0"
          >
            <Text className="text-black" style={BUTTON_LABEL_STYLE}>
              {primaryLabel}
            </Text>
          </Button>

          <Pressable
            accessibilityRole="button"
            onPress={onSecondary}
            disabled={isPrimaryPending}
            hitSlop={12}
            className="mt-4 transition-opacity active:opacity-60"
          >
            <Text className="text-center text-white/70" style={NOTE_STYLE}>
              {secondaryLabel}
            </Text>
          </Pressable>

          {!!footnote && (
            <Text className="mt-4 text-center text-white/40" style={FOOTNOTE_STYLE}>
              {footnote}
            </Text>
          )}
        </View>
      </View>
    </DialogContent>
  </Dialog>
);

const styles = StyleSheet.create({
  glow: {
    opacity: 0.35,
    position: 'absolute',
  },
});

export default TierPopup;
