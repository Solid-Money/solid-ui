import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { CircularActionButton } from '@/components/Card/CircularActionButton';
import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
import { Text } from '@/components/ui/text';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useDimension } from '@/hooks/useDimension';

export default function CardDetails() {
  const { data: cardDetails, isLoading } = useCardDetails();
  const { isScreenMedium } = useDimension();
  const router = useRouter();

  const availableBalance = cardDetails?.balances.available;
  const availableAmount = Number(availableBalance?.amount || '0').toString();

  if (isLoading) return <Loading />;

  return (
    <View className="flex-1 bg-background">
      {isScreenMedium && <Navbar />}

      <View className="flex-1 max-w-lg mx-auto pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">Card</Text>
          <View className="w-10" />
        </View>

        {/* Balance Information */}
        <View className="flex-1">
          <View className="items-center mt-10">
            <Text className="text-[50px] font-semibold">${availableAmount}</Text>
            <Text className="text-base opacity-70">Spendable balance</Text>
          </View>

          <View className="items-center my-12">
            <Image
              source={require('@/assets/images/card_details.png')}
              alt="Solid Card"
              style={{ width: '80%', aspectRatio: 414 / 693 }}
              contentFit="contain"
            />
          </View>

          {/* Circular Action Buttons */}
          <View className="flex-row justify-around items-center space-x-12">
            <CircularActionButton
              icon={require('@/assets/images/card_actions_fund.png')}
              label="Fund"
            />
            <CircularActionButton
              icon={require('@/assets/images/card_actions_settings.png')}
              label="Settings"
            />
            <CircularActionButton
              icon={require('@/assets/images/card_actions_limit.png')}
              label="Limit"
            />
            <CircularActionButton
              icon={require('@/assets/images/card_actions_freeze.png')}
              label="Freeze"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
