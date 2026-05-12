import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import AuthButton from '@/components/AuthButton';
import CardFeesModal from '@/components/CardWaitlist/CardFeesModal';
import GetCardButton from '@/components/CardWaitlist/GetCardButton';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

const CardWaitlistPageMobile = () => {
  const [feesOpen, setFeesOpen] = useState(false);

  return (
    <PageLayout
      scrollable={false}
      additionalContent={<CardFeesModal isOpen={feesOpen} onOpenChange={setFeesOpen} />}
    >
      <View className="flex-1 justify-between px-5 pb-24 pt-6">
        <View className="items-center justify-center gap-6">
          <Image
            source={getAsset('images/cards.png')}
            style={{ width: 300, height: 320 }}
            contentFit="contain"
          />

          <View className="items-center gap-3">
            <Text className="text-center text-3xl font-semibold">Free Visa Card</Text>
            <Text className="max-w-xs text-center text-base text-muted-foreground">
              3% cashback on all purchases. No monthly charge or hidden fees
            </Text>
          </View>
        </View>

        <View className="items-center gap-6">
          <Pressable
            onPress={() => setFeesOpen(true)}
            className="flex-row items-center gap-1 web:hover:opacity-70"
          >
            <Text className="text-base font-bold">Fees and charges</Text>
            <ChevronRight size={16} color="white" />
          </Pressable>

          <AuthButton>
            <GetCardButton className="w-full" />
          </AuthButton>
        </View>
      </View>
    </PageLayout>
  );
};

export default CardWaitlistPageMobile;
