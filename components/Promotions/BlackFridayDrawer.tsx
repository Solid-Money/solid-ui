import { useEffect } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useReferralCountdown } from '@/hooks/useReferralCountdown';
import { type BlackFridayOffer, formatBlackFridayFuse } from '@/lib/blackFriday';
import { formatPriceUsd } from '@/lib/tierUpgrade';

import BlackFridayDrawerHero, {
  BLACK_FRIDAY_DRAWER_BACKGROUND,
  BLACK_FRIDAY_DRAWER_RADIUS,
} from './BlackFridayDrawerHero';

const FOOTER_INSET = 34;
const surface = {
  backgroundColor: BLACK_FRIDAY_DRAWER_BACKGROUND,
  radius: BLACK_FRIDAY_DRAWER_RADIUS,
  title: 'Black Friday offers',
};

const offerRow = (name: string, offer: BlackFridayOffer) => ({
  name,
  detail: offer.lockFuse
    ? `For the first year · or lock ${formatBlackFridayFuse(offer.lockFuse)} FUSE`
    : 'For the first year',
  before: formatPriceUsd(offer.beforeUsd),
  now: formatPriceUsd(offer.saleUsd),
});

function SaleCountdown({ endsAt }: { endsAt: string }) {
  const time = useReferralCountdown(endsAt);
  const label = time && !time.isElapsed ? `Ends in ${time.label}` : 'Sale ended';

  return (
    <View style={styles.countdown}>
      <Text className="font-extrabold text-[#DDD2A5]" style={styles.countdownText}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export default function BlackFridayDrawer({
  prime,
  ultra,
  isOpen,
  onOpenChange,
  onSeeTiers,
}: {
  prime: BlackFridayOffer;
  ultra: BlackFridayOffer;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSeeTiers: () => void;
}) {
  const insets = useSafeAreaInsets();
  const endTime = Math.min(Date.parse(prime.endsAt), Date.parse(ultra.endsAt));
  const endsAt = new Date(endTime).toISOString();
  const lastDay = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(endTime - 1);
  const offers = [offerRow('Prime', prime), offerRow('Ultra', ultra)];
  if (ultra.cashback) {
    offers.push({
      name: 'Ultra cashback',
      detail: ultra.cashbackCap ? `This week, up to ${ultra.cashbackCap} a month` : 'This week',
      before: '5%',
      now: `${ultra.cashback}%`,
    });
  }

  useEffect(() => {
    if (!isOpen || Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onOpenChange(false);
      return true;
    });
    return () => listener.remove();
  }, [isOpen, onOpenChange]);

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="black-friday-offers"
      designTop={0}
      designBottom={
        Platform.OS === 'web' ? FOOTER_INSET : Math.max(0, FOOTER_INSET - insets.bottom)
      }
      fullBleed={surface}
      scrollable
    >
      {({ presentation }) => (
        <>
          <BlackFridayDrawerHero
            showHandle={presentation !== 'modal'}
            onClose={() => onOpenChange(false)}
          />
          <View style={styles.body}>
            <SaleCountdown endsAt={endsAt} />
            <View style={styles.heading}>
              <Text
                accessibilityRole="header"
                adjustsFontSizeToFit
                numberOfLines={1}
                className="text-center font-extrabold text-white"
                style={styles.title}
              >
                BLACK FRIDAY
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                className="text-center font-extrabold text-[#DDD2A5]"
                style={styles.title}
              >
                30% OFF TIERS
              </Text>
            </View>
            <Text className="text-center text-white/65" style={styles.description}>
              One week only. Upgrade for a year at the sale price.
            </Text>

            <View style={styles.offers}>
              {offers.map(({ name, detail, before, now }, index) => (
                <View key={name} style={[styles.offer, index > 0 && styles.offerDivider]}>
                  <View style={styles.offerLabel}>
                    <Text className="font-semibold text-white" style={styles.offerName}>
                      {name}
                    </Text>
                    <Text className="text-white/60" style={styles.offerDetail}>
                      {detail}
                    </Text>
                  </View>
                  <View
                    accessible
                    accessibilityLabel={`Originally ${before}, now ${now}`}
                    style={styles.price}
                  >
                    <Text
                      className="font-medium text-white/45 line-through"
                      style={styles.oldPrice}
                    >
                      {before}
                    </Text>
                    <Text className="font-extrabold text-[#DDD2A5]" style={styles.newPrice}>
                      {now}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Button
              onPress={() => {
                onOpenChange(false);
                onSeeTiers();
              }}
              className="native:h-14 mt-[22px] h-14 w-full rounded-2xl bg-[#DDD2A5] web:hover:bg-[#E8DDB3]"
            >
              <Text
                className="native:text-[17px] text-[17px] font-semibold text-[#121213]"
                style={styles.buttonText}
              >
                See the tiers
              </Text>
            </Button>
            <Text className="text-center text-white/50" style={styles.terms}>
              {`Sale ends ${lastDay}. After the first year the price returns to ${formatPriceUsd(prime.beforeUsd)} or ${formatPriceUsd(ultra.beforeUsd)}.`}
            </Text>
          </View>
        </>
      )}
    </CardBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  countdown: {
    backgroundColor: 'rgba(221,210,165,0.16)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countdownText: {
    fontFamily: 'MonaSans_800ExtraBold',
    fontSize: 11,
    letterSpacing: 0.44,
    lineHeight: 16,
  },
  heading: {
    alignSelf: 'stretch',
    marginTop: 14,
  },
  title: {
    fontFamily: 'MonaSans_800ExtraBold',
    fontSize: 36,
    letterSpacing: Platform.OS === 'android' ? 1.3 : 0,
    lineHeight: 44,
    marginVertical: -3.5,
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
  },
  offers: {
    alignSelf: 'stretch',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    marginTop: 22,
    paddingHorizontal: 18,
  },
  offer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  offerDivider: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
  },
  offerLabel: {
    flex: 1,
    gap: 3,
  },
  offerName: {
    fontFamily: 'MonaSans_600SemiBold',
    fontSize: 16.5,
    lineHeight: 23,
  },
  offerDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  price: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  oldPrice: {
    fontFamily: 'MonaSans_500Medium',
    fontSize: 15,
    lineHeight: 21,
  },
  newPrice: {
    fontFamily: 'MonaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 28,
  },
  buttonText: {
    fontFamily: 'MonaSans_600SemiBold',
    lineHeight: 24,
  },
  terms: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 14,
    maxWidth: 340,
  },
});
