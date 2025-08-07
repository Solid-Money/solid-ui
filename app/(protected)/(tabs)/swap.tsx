import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import SwapButton from '@/components/Swap/SwapButton';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import { Text } from '@/components/ui/text';

export default function SwapPage() {
  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {Platform.OS !== 'web' && <NavbarMobile />}
        {Platform.OS === 'web' && <Navbar />}

        <View className="flex-1 bg-black px-6 py-12">
          <Text className="text-white text-2xl font-semibold text-center mb-12">Swap</Text>

          <View className="flex flex-col lg:flex-row gap-8 items-start justify-center">
            <View className="flex flex-col gap-1 w-full lg:w-[450px] flex-shrink-0 bg-card rounded-3xl border border-border/10">
              <SwapPair />
              <SwapParams />
              <View className="mt-auto flex flex-col px-6 pb-6">
                <SwapButton />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
