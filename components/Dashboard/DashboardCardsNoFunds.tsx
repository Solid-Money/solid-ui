import React from 'react';
import { Image, Text, View } from 'react-native';

export function DashboardCardsNoFunds() {
  return <DepositStableCoinsCard />;
}

function DepositStableCoinsCard() {
  return (
    <View className="w-full h-[420px] bg-gradient-to-tr from-[rgba(165,84,234,0.25)] to-[rgba(165,84,234,0.175)] rounded-2xl p-10 shadow-sm">
      <View className="flex-1">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 items-start gap-24">
            <Text className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-white">
              Deposit your stablecoins{'\n'}and earn{' '}
              <Text className="text-[#94F27F] underline">4.5%</Text> per year
            </Text>
            <IconsWithText />
          </View>
          <View className="ml-4">
            <Image
              source={require('@/assets/images/solid_logo_with_glare.png')}
              style={{ width: 360, height: 360 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function IconsWithText() {
  return (
    <View className="flex-row w-[65%] justify-between">
      <IconWithText
        iconSource={require('@/assets/images/no_funds_deposit_icon.png')}
        text={`Deposit as${'\n'}little as $1`}
      />
      <IconWithText
        iconSource={require('@/assets/images/no_funds_withdraw_icon.png')}
        text={`Withdraw${'\n'}anytime`}
      />
      <IconWithText
        iconSource={require('@/assets/images/no_funds_earn_icon.png')}
        text={`Earn every${'\n'}second`}
      />
    </View>
  );
}

function IconWithText({ iconSource, text }: { iconSource: any; text: string }) {
  return (
    <View>
      <Image source={iconSource} style={{ width: 60, height: 60 }} />
      <Text className="text-base sm:text-lg md:text-xl lg:text-2xl text-white mt-4">{text}</Text>
    </View>
  );
}
