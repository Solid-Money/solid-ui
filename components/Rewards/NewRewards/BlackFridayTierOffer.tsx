import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { formatBlackFridayFuse } from '@/lib/blackFriday';
import { formatPriceUsd } from '@/lib/tierUpgrade';

import type { BlackFridayOffer } from '@/lib/blackFriday';

export const BLACK_FRIDAY_GOLD = '#DDD2A5';
const gradient = require('@/assets/images/black-friday/banner-fill.png');

export function BlackFridayChip({
  children,
  dark,
  scale: s,
}: {
  children: string;
  dark?: boolean;
  scale: number;
}) {
  return (
    <View
      style={{
        alignSelf: 'center',
        paddingHorizontal: 12 * s,
        paddingVertical: 5 * s,
        borderRadius: 100,
        backgroundColor: dark ? 'rgba(0,0,0,0.28)' : 'rgba(221,210,165,0.16)',
      }}
    >
      <Text
        className="font-extrabold text-[#DDD2A5]"
        style={{ fontFamily: 'MonaSans_800ExtraBold', fontSize: 11 * s, letterSpacing: 0.44 * s }}
      >
        {children}
      </Text>
    </View>
  );
}

export function BlackFridayTierPrice({
  offer,
  scale: s,
}: {
  offer: BlackFridayOffer;
  scale: number;
}) {
  return (
    <Text className="text-center text-white/70" style={{ fontSize: 17 * s, lineHeight: 23 * s }}>
      <Text className="text-white/45 line-through">{formatPriceUsd(offer.beforeUsd)}</Text>{' '}
      <Text className="font-semibold text-[#DDD2A5]">{formatPriceUsd(offer.saleUsd)}/year</Text>
      {offer.lockFuse ? (
        <>
          {' or '}
          {!!offer.beforeFuse && (
            <>
              <Text className="text-white/45 line-through">
                {formatBlackFridayFuse(offer.beforeFuse)}
              </Text>{' '}
            </>
          )}
          <Text className="font-semibold text-[#DDD2A5]">
            {formatBlackFridayFuse(offer.lockFuse)}
          </Text>
          {' FUSE locked'}
        </>
      ) : null}
    </Text>
  );
}

function OfferLine({
  value,
  heading,
  detail,
  scale: s,
}: {
  value: string;
  heading: string;
  detail: string;
  scale: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 * s }}>
      <Text
        className="font-light text-[#DDD2A5]"
        style={{
          fontFamily: 'MonaSans_300Light',
          fontSize: 40 * s,
          lineHeight: 48 * s,
          letterSpacing: -1.6 * s,
          minWidth: 90 * s,
        }}
      >
        {value}
      </Text>
      <View style={{ flex: 1, gap: 2 * s }}>
        <Text
          className="font-semibold text-white"
          style={{ fontSize: 15.5 * s, lineHeight: 20 * s }}
        >
          {heading}
        </Text>
        <Text className="text-white/70" style={{ fontSize: 13 * s, lineHeight: 18 * s }}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

export default function BlackFridayTierPanel({
  offer,
  tierName,
  countdown,
  scale: s,
}: {
  offer: BlackFridayOffer;
  tierName: string;
  countdown: string;
  scale: number;
}) {
  const discount = Math.round((1 - offer.saleUsd / offer.beforeUsd) * 100);
  const lock = offer.lockFuse ? `, or lock ${formatBlackFridayFuse(offer.lockFuse)} FUSE` : '';

  return (
    <View
      style={{
        marginHorizontal: 16 * s,
        marginTop: 14 * s,
        paddingHorizontal: 18 * s,
        paddingVertical: 16 * s,
        borderRadius: 16 * s,
        overflow: 'hidden',
        gap: 12 * s,
      }}
    >
      <Image
        accessible={false}
        source={gradient}
        contentFit="fill"
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          className="font-extrabold text-white"
          style={{ fontFamily: 'MonaSans_800ExtraBold', fontSize: 20 * s, lineHeight: 26 * s }}
        >
          BLACK FRIDAY
        </Text>
        <BlackFridayChip dark scale={s}>
          {countdown}
        </BlackFridayChip>
      </View>
      <OfferLine
        value={`-${discount}%`}
        heading={`Off ${tierName}`}
        detail={`${formatPriceUsd(offer.saleUsd)} for the first year${lock}`}
        scale={s}
      />
      {!!offer.cashback && (
        <>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
          <OfferLine
            value={`${offer.cashback}%`}
            heading="Cashback this week"
            detail={
              offer.cashbackCap
                ? `Instead of 5%, up to ${offer.cashbackCap} a month`
                : 'Instead of 5%'
            }
            scale={s}
          />
        </>
      )}
    </View>
  );
}
