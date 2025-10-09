import CopyToClipboard from '@/components/CopyToClipboard';
import Navbar from '@/components/Navbar';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Savings() {
  const { isScreenMedium } = useDimension();
  const { user } = useUser();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}
        <View className="flex-1 justify-center gap-10 px-4 py-8 w-full max-w-lg mx-auto">
          <View className="gap-10 md:gap-20 w-full mx-auto">
            <View className="flex-row items-center justify-between md:mt-16">
              <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
                <ArrowLeft color="white" />
              </Pressable>
              <Text className="text-white text-xl md:text-3xl font-semibold text-center">
                Refer a Friend
              </Text>
              <View className="w-10" />
            </View>
            <View className="flex-col items-center justify-center w-full">
              <Image
                source={require('@/assets/images/referral_large.png')}
                style={{ width: 250, height: 250 }}
              />
              <Text className="text-white/70 text-center mt-8">
                Earn 10% of your referral&apos;s points when <br />
                they use Solid App
              </Text>
              <View className="flex-row w-[400px] justify-between items-center p-4 ps-6 bg-primary/10 rounded-2xl text-primary font-medium mt-6">
                <Text>https://app.solid.xyz/join/{user?.referralCode}</Text>
                <CopyToClipboard text={`https://app.solid.xyz/join/${user?.referralCode}`} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
