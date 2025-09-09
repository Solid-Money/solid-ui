import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Navbar from '@/components/Navbar';
import SwapButton from '@/components/Swap/SwapButton';
import SwapModal from '@/components/Swap/SwapModal';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/firebase';

export default function SwapPage() {
  const router = useRouter();
  const { isScreenMedium } = useDimension();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}

        <View className="flex-1 gap-10 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                track('swap_page_back_button_pressed', {
                  source: 'swap_page',
                });
                router.back();
              }}
              className="web:hover:opacity-70"
            >
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-white text-xl md:text-3xl font-semibold text-center">Swap</Text>
            <View className="w-10" />
          </View>

          <View className="flex flex-col gap-2 flex-shrink-0">
            <SwapPair />
            <SwapParams />
            <View className="mt-auto flex flex-col">
              <SwapButton />
            </View>
          </View>
        </View>
      </ScrollView>

      <SwapModal />
    </SafeAreaView>
  );
}
