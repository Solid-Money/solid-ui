import React, { Fragment, ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { CrossChainSendNetworkConfig } from '@/lib/types/cross-chain-send';
import { cn } from '@/lib/utils';
import { NETWORK_ICONS } from '@/lib/utils/cross-chain-send';

export const BRAND = '#94f27f';

type NetworkIconProps = {
  networkKey: CrossChainSendNetworkConfig['key'] | undefined;
  size?: number;
};

/** The network's logo inside a circle with the card-coloured ring the rows use. */
export const NetworkIcon = ({ networkKey, size = 36 }: NetworkIconProps) => (
  <View
    className="items-center justify-center overflow-hidden rounded-full border-[2.25px] border-card bg-[#333]"
    style={{ width: size, height: size }}
  >
    {networkKey ? (
      <Image
        source={getAsset(NETWORK_ICONS[networkKey])}
        style={{ width: size - 4.5, height: size - 4.5 }}
        contentFit="cover"
      />
    ) : null}
  </View>
);

type LetterAvatarProps = {
  letter: string;
  size?: number;
  className?: string;
};

export const LetterAvatar = ({ letter, size = 36, className }: LetterAvatarProps) => (
  <View
    className={cn('items-center justify-center rounded-full bg-[#333]', className)}
    style={{ width: size, height: size }}
  >
    <Text className="text-base font-semibold leading-5 text-white">{letter}</Text>
  </View>
);

type ChipProps = {
  label: string;
  tone?: 'grey' | 'brand';
};

/** Inline pill beside a row title: "Recommended", "~3 min". */
export const Chip = ({ label, tone = 'grey' }: ChipProps) => (
  <View
    className={cn(
      'rounded-[18px] px-2 pb-[3px] pt-[2px]',
      tone === 'brand' ? 'bg-[rgba(148,242,127,0.16)]' : 'bg-[#333]',
    )}
  >
    <Text className={cn('text-sm leading-4', tone === 'brand' ? 'text-brand' : 'text-white/70')}>
      {label}
    </Text>
  </View>
);

export type DetailRowSpec = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

type DetailCardProps = {
  rows: DetailRowSpec[];
  className?: string;
};

/** Label/value rows in a card, hairline-divided — the quote and review cards. */
export const DetailCard = ({ rows, className }: DetailCardProps) => (
  <View className={cn('overflow-hidden rounded-[15px] bg-card', className)}>
    {rows.map((row, index) => (
      <Fragment key={row.key}>
        {index > 0 ? <View className="h-px bg-white/10" /> : null}
        <View className="flex-row items-center justify-between gap-3 px-[18px] py-[14px]">
          {typeof row.label === 'string' ? (
            <Text className="text-base text-white/70">{row.label}</Text>
          ) : (
            row.label
          )}
          {typeof row.value === 'string' ? (
            <Text className="shrink text-right text-base font-medium text-white">{row.value}</Text>
          ) : (
            row.value
          )}
        </View>
      </Fragment>
    ))}
  </View>
);

export const Divider = () => <View className="h-px bg-white/10" />;
