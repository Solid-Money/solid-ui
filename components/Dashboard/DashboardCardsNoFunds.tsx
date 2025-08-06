import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { DepositOptionModal } from '../DepositOption';
import { buttonVariants } from '../ui/button';
import { Plus } from 'lucide-react-native';

function FundWalletCard() {
  return (
    <View className="w-full h-[280px] md:h-full bg-gradient-to-tr from-[rgba(126,126,126,0.25)] to-[rgba(126,126,126,0.175)] rounded-2xl p-6 pl-8 shadow-sm md:w-[50%]">
      <View className="flex-1 flex-row justify-between items-start">
        <View className="flex-1 h-full justify-between">
          <View className="space-y-2">
            <View>
              <Text className="text-3xl font-semibold text-white">Fund your wallet</Text>
            </View>
            <View>
              <Text className="text-base text-muted-foreground">
                Fund your account with crypto{'\n'}you already own or with cash
              </Text>
            </View>
          </View>
          <AddFundsButton />
        </View>
        <View className="ml-4">
          <Image
            source={require('@/assets/images/fund_your_wallet_large.png')}
            style={{ width: 216, height: 216 }}
          />
        </View>
      </View>
    </View>
  );
}

function AddFundsButton() {
  return (
    <DepositOptionModal
      trigger={
        <View
          className={buttonVariants({
            variant: 'secondary',
            className: 'h-11 rounded-xl bg-[#303030] border border-[#4E4E4E] self-start',
          })}
        >
          <Text className="text-white text-base font-bold">Add funds</Text>
        </View>
      }
    />
  );
}

function DepositStableCoinsCard() {
  return (
    <View className="w-full h-[280px] md:h-full bg-gradient-to-tr from-[rgba(165,84,234,0.25)] to-[rgba(165,84,234,0.175)] rounded-2xl p-6 shadow-sm md:w-[50%]">
      <View className="flex-1 flex-row justify-between items-start">
        <View className="flex-1 h-full justify-between">
          <View>
            <Text className="text-3xl font-semibold text-white">
              Deposit your stablecoins{'\n'}and earn{' '}
              <Text className="text-[#94F27F] underline">4.5%</Text> per year
            </Text>
          </View>
          <StartEarningButton />
        </View>
        <View className="ml-4">
          <Image
            source={require('@/assets/images/solid_logo_with_glare.png')}
            style={{ width: 200, height: 200 }}
          />
        </View>
      </View>
    </View>
  );
}

function StartEarningButton() {
  return (
    <TouchableOpacity className="bg-[#6F449A99] rounded-lg py-2 px-8 self-start">
      <Text className="text-white text-base font-bold">Start earning</Text>
    </TouchableOpacity>
  );
}

export function DashboardCardsNoFunds() {
  return (
    <View className="flex flex-col md:flex-row justify-between items-center gap-6 md:min-h-40">
      <FundWalletCard />
      <DepositStableCoinsCard />
    </View>
  );
}
