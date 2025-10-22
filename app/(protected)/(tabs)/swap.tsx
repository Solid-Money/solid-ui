import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import PageLayout from '@/components/PageLayout';
import SwapButton from '@/components/Swap/SwapButton';
import SwapModal from '@/components/Swap/SwapModal';
import SwapPair from '@/components/Swap/SwapPair';
import SwapParams from '@/components/Swap/SwapParams';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

export default function SwapPage() {
  const router = useRouter();

  return (
    <PageLayout desktopOnly scrollable={false} additionalContent={<SwapModal />}>
      <ScrollView className="flex-1">
        <View className="flex-1 gap-10 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                track(TRACKING_EVENTS.SWAP_PAGE_BACK_BUTTON_PRESSED, {
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
    </PageLayout>
  );
}
