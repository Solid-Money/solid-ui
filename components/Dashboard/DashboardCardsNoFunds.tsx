import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Underline } from '@/components/ui/underline';
import { getAsset } from '@/lib/assets';

export function DashboardCardsNoFunds() {
  return <DepositStableCoinsCard />;
}

function DepositStableCoinsCard() {
  return (
    <View className="w-full rounded-2xl bg-gradient-to-tr from-[rgba(165,84,234,0.25)] to-[rgba(165,84,234,0.175)] p-10 px-12  shadow-sm">
      <View className="flex-1">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 items-start gap-24">
            <Text className="text-xl font-semibold text-white sm:text-2xl md:text-3xl lg:text-4xl">
              Deposit your stablecoins{'\n'}and earn{' '}
              <Underline inline textClassName="text-[#94F27F]" borderColor="rgba(148, 242, 127, 1)">
                4.5%
              </Underline>{' '}
              per year
            </Text>
            <IconsWithText />
          </View>
          <View className="ml-4">
            <Image
              source={getAsset('images/solid_logo_with_glare.png')}
              style={{ width: 320, height: 320 }}
              alt="Solid logo"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function IconsWithText() {
  return (
    <View className="w-[65%] flex-row justify-between">
      <IconWithText
        iconSource={getAsset('images/no_funds_deposit_icon.png')}
        text={`Deposit as${'\n'}little as $1`}
        alt="Deposit icon"
      />
      <IconWithText
        iconSource={getAsset('images/no_funds_withdraw_icon.png')}
        text={`Withdraw${'\n'}anytime`}
        alt="Withdraw icon"
      />
      <IconWithText
        iconSource={getAsset('images/no_funds_earn_icon.png')}
        text={`Earn every${'\n'}second`}
        alt="Earn rewards icon"
      />
    </View>
  );
}

function IconWithText({ iconSource, text, alt }: { iconSource: any; text: string; alt: string }) {
  return (
    <View>
      <Image source={iconSource} style={{ width: 60, height: 60 }} alt={alt} />
      <Text className="mt-4 text-base text-white sm:text-lg md:text-xl lg:text-2xl">{text}</Text>
    </View>
  );
}
