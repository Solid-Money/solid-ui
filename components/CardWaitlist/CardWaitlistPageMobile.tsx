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
      <View className="flex-1 px-5 pb-4 pt-2">
        <View className="flex-1 items-center justify-center">
          <Image
            source={getAsset('images/cards.png')}
            style={{ width: 280, height: 305 }}
            contentFit="contain"
          />
        </View>

        <View className="mb-10 items-center gap-3">
          <Text className="text-center text-3xl font-semibold">Free Visa Card</Text>
          <Text className="max-w-xs text-center text-base text-muted-foreground">
            3% cashback on all purchases. No monthly charge or hidden fees
          </Text>
        </View>

        <View className="mb-6 items-center">
          <Pressable
            onPress={() => setFeesOpen(true)}
            className="flex-row items-center gap-1 web:hover:opacity-70"
          >
            <Text className="text-base font-bold">Fees and charges</Text>
            <ChevronRight size={16} color="white" />
          </Pressable>
        </View>

        <AuthButton>
          <GetCardButton className="w-full" />
        </AuthButton>
      </View>
    </PageLayout>
  );
};

export default CardWaitlistPageMobile;
