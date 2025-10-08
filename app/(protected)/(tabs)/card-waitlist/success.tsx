import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';
import CardWaitlistBackButton from '@/components/CardWaitlist/CardWaitlistBackButton';

import Checkmark from '@/assets/images/checkmark';

const CardWaitlist = () => {
  return (
    <CardWaitlistHeader content={<CardWaitlistHeaderTitle />}>
      <CardWaitlistContainer>
        <View className="flex-1 gap-14 bg-transparent p-5 md:px-12 md:py-14">
          <Checkmark width={86} height={86} color="#94F27F" />

          <View className="gap-2">
            <Text className="text-2xl md:text-4.5xl font-semibold">You reserved your spot!</Text>
            <Text className="text-muted-foreground max-w-56 md:max-w-full">
              We will let you know once the card goes live
            </Text>
          </View>

          <View className="items-start">
            <CardWaitlistBackButton />
          </View>
        </View>
      </CardWaitlistContainer>
    </CardWaitlistHeader>
  );
};

export default CardWaitlist;
