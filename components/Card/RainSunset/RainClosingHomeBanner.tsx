import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useRainSunset } from '@/hooks/useRainSunset';
import { getAsset } from '@/lib/assets';
import {
  homeBannerCopy,
  RainClosingBannerState,
  rainClosingBannerState,
} from '@/lib/utils/rainSunset';
import { useRainSunsetStore } from '@/store/useRainSunsetStore';

const GREEN = '#94F27F';

/** A pill button exactly as the banner draws it: 35 tall, 16 across, fully rounded. */
const PillButton = ({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={[styles.pill, { backgroundColor: primary ? GREEN : '#2A2A2A' }]}
  >
    <Text
      className="text-[16px] font-semibold"
      style={{ color: primary ? '#000000' : '#FFFFFF' }}
      numberOfLines={1}
    >
      {label}
    </Text>
  </Pressable>
);

/**
 * The Home banner for a cardholder whose card is closing (Figma "Rain closing /
 * Home banner", 30558:17986). Same slot as the outage notice, at the top of Home.
 *
 * Three states, picked from `/cards/status` and the balance on the card:
 *  - `new-card`: the new card is available to them — offered now, not after the
 *    close (the design's "Closed · new card" state, moved forward).
 *  - `closing-balance`: no new card for them yet, money on the card — Withdraw.
 *    No close button: the design keeps it up while there is money to move.
 *  - `closing-empty`: nothing to withdraw — closable.
 *
 * Renders nothing for anyone the sunset does not affect, which is almost
 * everyone, and nothing while the balance is still being read.
 */
const RainClosingHomeBanner = ({ className }: { className?: string }) => {
  const router = useRouter();
  const { sunset, balanceUsd, isBalanceLoading } = useRainSunset();
  const dismissed = useRainSunsetStore(state => state.dismissedBanners);
  const dismissBanner = useRainSunsetStore(state => state.dismissBanner);
  const openSheet = useRainSunsetStore(state => state.setSheetOpen);

  if (!sunset) return null;
  if (sunset.hasRainCard && isBalanceLoading) return null;

  const state = rainClosingBannerState(sunset, balanceUsd);
  if (!state) return null;

  const key = `${state}@${sunset.closesAt ?? 'none'}`;
  const closable: Record<RainClosingBannerState, boolean> = {
    'new-card': true,
    'closing-balance': false,
    'closing-empty': true,
  };
  if (closable[state] && dismissed.includes(key)) return null;

  const { title, message } = homeBannerCopy(state, sunset, balanceUsd);
  const art =
    state === 'new-card'
      ? getAsset('images/card-new-card-art.svg')
      : getAsset('images/card-closing-art.svg');

  const goToNewCard = () => router.push(path.CARD_NEW_CARD);
  const goToWithdraw = () => router.push(path.CARD_CLOSING_WITHDRAW);

  return (
    <HeroExit spec={HERO_EXIT.balance} className={className}>
      <View style={styles.banner}>
        <View style={styles.text}>
          <Text className="text-[18px] font-semibold leading-[24px] text-white">{title}</Text>
          <Text className="text-[14px] leading-[18px] text-white/70">{message}</Text>
          <View style={styles.buttons}>
            {state === 'new-card' ? (
              <PillButton
                label={sunset.migration ? 'Continue' : 'Get new card'}
                primary
                onPress={goToNewCard}
              />
            ) : null}
            {state === 'closing-balance' ? (
              <PillButton label="Withdraw" primary onPress={goToWithdraw} />
            ) : null}
            {state !== 'new-card' ? (
              <PillButton
                label="What's changing"
                primary={state === 'closing-empty'}
                onPress={() => openSheet(true)}
              />
            ) : null}
          </View>
        </View>
        <Image source={art} style={styles.art} contentFit="contain" />
        {closable[state] ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close notice"
            hitSlop={12}
            onPress={() => dismissBanner(key)}
            style={styles.dismiss}
          >
            <X size={20} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ) : null}
      </View>
    </HeroExit>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#1C1C1C',
  },
  text: { flex: 1, gap: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
  pill: {
    height: 35,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: 64, height: 64 },
  dismiss: {
    position: 'absolute',
    top: 11,
    right: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RainClosingHomeBanner;
