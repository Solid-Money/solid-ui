import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import AuthButton from '@/components/AuthButton';
import CardFeesModal from '@/components/CardWaitlist/CardFeesModal';
import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';
import CardWaitlistHeaderButtons from '@/components/CardWaitlist/CardWaitlistHeaderButtons';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import GetCardButton from '@/components/CardWaitlist/GetCardButton';
import SolidCardSummary from '@/components/CardWaitlist/SolidCardSummary';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

const CardWaitlistPage = () => {
  const { isScreenMedium } = useDimension();
  const [feesOpen, setFeesOpen] = useState(false);

  return (
    <CardWaitlistHeader
      content={
        <View className="md:flex-row md:items-center md:justify-between">
          <CardWaitlistHeaderTitle />
          {isScreenMedium && <CardWaitlistHeaderButtons />}
        </View>
      }
    >
      <CardWaitlistContainer>
        <View className="flex-1 gap-8 bg-transparent p-5 py-7 pb-20 md:justify-center md:gap-10 md:px-12 md:py-10">
          <SolidCardSummary />

          {!isScreenMedium && (
            <Image
              source={getAsset('images/cards.png')}
              style={{ width: 289, height: 305 }}
              contentFit="contain"
            />
          )}

          <View className="flex-row items-center gap-6">
            <AuthButton>
              <GetCardButton />
            </AuthButton>
            <Pressable
              onPress={() => setFeesOpen(true)}
              className="flex-row items-center gap-1 web:hover:opacity-70"
            >
              <Text className="text-base font-bold">Fees and charges</Text>
              <ChevronRight size={16} color="white" />
            </Pressable>
          </View>
        </View>
      </CardWaitlistContainer>

      <CardFeesModal isOpen={feesOpen} onOpenChange={setFeesOpen} />
    </CardWaitlistHeader>
  );
};

export default CardWaitlistPage;
