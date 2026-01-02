import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';
import CardWaitlistBackButton from '@/components/CardWaitlist/CardWaitlistBackButton';
import { useDimension } from '@/hooks/useDimension';

import Checkmark from '@/assets/images/checkmark';

const CardWaitlist = () => {
  const { isScreenMedium } = useDimension();

  return (
    <CardWaitlistHeader content={<CardWaitlistHeaderTitle />}>
      <CardWaitlistContainer>
        <View className="flex-1 gap-8 bg-transparent p-5 py-7 md:gap-14 md:px-12 md:py-14">
          <Checkmark width={86} height={86} color="#94F27F" />

          <View className="gap-2">
            <Text className="text-2xl font-semibold md:text-4.5xl">You reserved your spot!</Text>
            <Text className="max-w-56 text-muted-foreground md:max-w-full">
              We will let you know once the card goes live
            </Text>
          </View>

          {!isScreenMedium && (
            <Image
              source={require('@/assets/images/cards.png')}
              style={{ width: 289, height: 305 }}
              contentFit="contain"
            />
          )}

          <View className="md:items-start">
            <CardWaitlistBackButton />
          </View>
        </View>
      </CardWaitlistContainer>
    </CardWaitlistHeader>
  );
};

export default CardWaitlist;
