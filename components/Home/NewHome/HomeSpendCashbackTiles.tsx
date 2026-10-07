import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { SPEND_MODE_COPY } from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import CashbackDetailsSheet from '@/components/Rewards/NewRewards/CashbackDetailsSheet';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useRewardsUserData } from '@/hooks/useRewards';
import { CASHBACK_EARNED_COLOR, monthlyCashbackTotal } from '@/lib/cashbackProgress';
import { resolveUserCashbackRate, TIER_CASHBACK_RATES } from '@/lib/tierCashback';
import { RewardsTier } from '@/lib/types';
import { formatBalanceUSD } from '@/lib/utils';
import { useCardPaneStore } from '@/store/useCardPaneStore';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

const spendGlow = require('@/assets/images/home-spend-tiles/spend-glow.svg');
const cashbackGlow = require('@/assets/images/home-spend-tiles/cashback-glow.svg');
const down = require('@/assets/images/home-spend-tiles/down.svg');
const TILE_ARTWORK_WIDTH = 182;
const tilePressClassName =
  'ios:active:bg-[#2A2A2A] native:transition-transform native:duration-200 native:ease-out native:active:scale-[0.98] native:active:opacity-90 bg-[#1C1C1C]';
const tileRipple =
  Platform.OS === 'android' ? { color: 'rgba(255, 255, 255, 0.08)', foreground: true } : undefined;

type HomeSpendCashbackTilesProps = {
  figures: Pick<
    SpendModeFigures,
    'mode' | 'canChangeMode' | 'cashBalance' | 'segmentValue' | 'isLoading'
  >;
};

/** Figma 27864:7806 / 27864:7789, beneath the Wirex card on home. */
const HomeSpendCashbackTiles = ({ figures }: HomeSpendCashbackTilesProps) => {
  const [tileWidth, setTileWidth] = useState(TILE_ARTWORK_WIDTH);
  const tilePadding = tileWidth < 160 ? 12 : tileWidth < 180 ? 16 : 20;
  // Web Text truncates instead of auto-fitting. Keep the full captions visible
  // in narrow columns while retaining the design's type size on wider ones.
  const captionSize = Math.min(14, ((tileWidth - tilePadding * 2) / 145) * 14);
  const tileStyle = [styles.tile, { padding: tilePadding }];
  const captionStyle = [styles.caption, { fontSize: captionSize }];
  // The artwork was positioned for a phone-width tile. Scale its whole canvas
  // on web so wider tiles don't expose the glow's circular edge before it fades.
  const artworkStyle = [
    styles.artwork,
    Platform.OS === 'web' && { transform: [{ scale: tileWidth / TILE_ARTWORK_WIDTH }] },
  ];
  const openSpendMode = useCardPaneStore(state => state.openSpendMode);
  const { data: rewardsData } = useRewardsUserData();
  const { data: cardDetails } = useCardDetails();
  const rate = resolveUserCashbackRate(rewardsData) || TIER_CASHBACK_RATES[RewardsTier.CORE];
  const cashbackThisMonth = rewardsData?.cashbackThisMonth ?? 0;
  const earnedThisMonth = monthlyCashbackTotal(
    cashbackThisMonth,
    rewardsData?.cashbackPendingThisMonth,
  );
  // The Cash segment's empty-state text is "Add funds"; the home tile always
  // shows a balance. Credit and Smart use the same availability as the picker.
  const available =
    figures.mode === 'cash' ? figures.cashBalance : figures.segmentValue[figures.mode];
  const modeLabel = `${SPEND_MODE_COPY[figures.mode].label} mode`;

  return (
    <View style={styles.row}>
      <View style={styles.slot} onLayout={event => setTileWidth(event.nativeEvent.layout.width)}>
        <Pressable
          accessibilityRole={figures.canChangeMode ? 'button' : undefined}
          accessibilityLabel={`${modeLabel}. Available to spend: ${figures.isLoading ? 'Loading' : available}`}
          disabled={!figures.canChangeMode}
          onPress={() => openSpendMode()}
          android_ripple={tileRipple}
          className={tilePressClassName}
          style={tileStyle}
        >
          <View pointerEvents="none" style={artworkStyle}>
            <View style={styles.spendGlowStage}>
              <Image
                accessible={false}
                source={spendGlow}
                contentFit="fill"
                style={styles.spendGlow}
              />
            </View>
            <View style={styles.spendBeamStage}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.05)']}
                style={styles.spendBeam}
              />
            </View>
          </View>
          <View style={styles.modeChip}>
            <Text
              numberOfLines={1}
              style={[styles.chipText, tileWidth < 160 && styles.compactChipText]}
            >
              {modeLabel}
            </Text>
            {figures.canChangeMode && (
              <Image accessible={false} source={down} contentFit="fill" style={styles.down} />
            )}
          </View>
          <View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={styles.amount}
            >
              {figures.isLoading ? '—' : available}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={captionStyle}
            >
              Available to spend
            </Text>
          </View>
        </Pressable>
      </View>
      <View style={styles.slot}>
        <CashbackDetailsSheet
          triggerContainerClassName=""
          cashbackRate={rate}
          cashbackThisMonth={cashbackThisMonth}
          cashbackPendingThisMonth={rewardsData?.cashbackPendingThisMonth}
          maxCashbackMonthly={rewardsData?.maxCashbackMonthly ?? 0}
          allTimeCashback={Math.max(cardDetails?.cashback?.totalUsdValue ?? 0, cashbackThisMonth)}
          onGetMoreCashback={() => router.push(path.REWARDS_BENEFITS)}
          trigger={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View cashback details"
              android_ripple={tileRipple}
              className={tilePressClassName}
              style={tileStyle}
            >
              <View pointerEvents="none" style={artworkStyle}>
                <View style={styles.cashbackGlowStage}>
                  <Image
                    accessible={false}
                    source={cashbackGlow}
                    contentFit="fill"
                    style={styles.cashbackGlow}
                  />
                </View>
                <View style={styles.cashbackBeamStage}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.05)']}
                    style={styles.cashbackBeam}
                  />
                </View>
              </View>
              <View style={styles.cashbackChip}>
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, tileWidth < 160 && styles.compactChipText]}
                >
                  {rate}% Cashback
                </Text>
              </View>
              <View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.amount, styles.cashbackAmount]}
                >
                  +{formatBalanceUSD(earnedThisMonth)}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={captionStyle}
                >
                  Cashback this month
                </Text>
              </View>
            </Pressable>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 20, paddingHorizontal: 18 },
  slot: { flex: 1, minWidth: 0 },
  tile: {
    borderRadius: 20,
    height: 160,
    justifyContent: 'space-between',
    minWidth: 0,
    overflow: 'hidden',
    padding: 20,
  },
  artwork: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: TILE_ARTWORK_WIDTH,
    height: 160,
    transformOrigin: 'top left',
  },
  modeChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 5,
  },
  cashbackChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    paddingLeft: 12,
    paddingRight: 11,
    paddingVertical: 5,
  },
  chipText: { color: '#FFFFFF', fontFamily: 'MonaSans_500Medium', fontSize: 14, lineHeight: 20 },
  compactChipText: { fontSize: 12 },
  down: { width: 14, height: 14 },
  amount: { color: '#FFFFFF', fontFamily: 'MonaSans_600SemiBold', fontSize: 22, lineHeight: 31 },
  cashbackAmount: { color: CASHBACK_EARNED_COLOR },
  caption: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  spendGlowStage: {
    position: 'absolute',
    left: -235,
    top: -308.14,
    width: 455.747,
    height: 455.747,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spendGlow: { width: 383.078, height: 383.078, transform: [{ rotate: '167.73deg' }] },
  spendBeamStage: {
    position: 'absolute',
    left: -99.79,
    top: -80.03,
    width: 393.791,
    height: 145.378,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spendBeam: { width: 386.317, height: 76.531, transform: [{ rotate: '169.54deg' }] },
  cashbackGlowStage: {
    position: 'absolute',
    left: -92.18,
    top: -361,
    width: 521.477,
    height: 521.477,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashbackGlow: {
    width: 438.327,
    height: 438.327,
    transform: [{ rotate: '12.27deg' }, { scaleY: -1 }],
  },
  cashbackBeamStage: {
    position: 'absolute',
    left: -176,
    top: -100,
    width: 450.585,
    height: 166.345,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashbackBeam: {
    width: 442.033,
    height: 87.569,
    transform: [{ rotate: '10.46deg' }, { scaleY: -1 }],
  },
});

export default HomeSpendCashbackTiles;
