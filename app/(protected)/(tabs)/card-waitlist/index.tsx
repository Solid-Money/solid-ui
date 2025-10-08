import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import CardWaitlistHeaderButtons from '@/components/CardWaitlist/CardWaitlistHeaderButtons';
import ReserveCardButton from '@/components/CardWaitlist/ReserveCardButton';
import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';

type FeatureProps = {
  icon: string;
  title: string;
  description: string;
};

const Feature = ({ icon, title, description }: FeatureProps) => {
  return (
    <View className="flex-row items-center gap-2 w-[17rem]">
      <Image source={icon} style={{ width: 50, height: 50 }} contentFit="contain" />
      <View>
        <Text className="md:text-lg leading-5 font-bold">{title}</Text>
        <Text className="text-sm md:text-base text-muted-foreground max-w-44 md:max-w-56">
          {description}
        </Text>
      </View>
    </View>
  );
};

const features = [
  {
    icon: require('@/assets/images/card-global.png'),
    title: 'Global acceptance',
    description: '200M+ Visa merchants',
  },
  {
    icon: require('@/assets/images/card-earn.png'),
    title: 'Earn while you spend',
    description: '2% cashback',
  },
  {
    icon: require('@/assets/images/card-safe.png'),
    title: 'Safe by design',
    description: 'Non-custodial, secured by passkeys',
  },
  {
    icon: require('@/assets/images/card-effortless.png'),
    title: 'Effortless setup',
    description: 'Start using instantly. Apple/Google Pay support',
  },
];

const CardWaitlist = () => {
  return (
    <CardWaitlistHeader
      content={
        <View className="flex-row justify-between items-center">
          <CardWaitlistHeaderTitle />
          <CardWaitlistHeaderButtons />
        </View>
      }
    >
      <CardWaitlistContainer>
        <View className="flex-1 gap-14 bg-transparent p-5 md:px-12 md:py-10">
          <View className="items-start gap-4">
            <View className="bg-brand/10 rounded-full px-5 py-1.5">
              <Text className="text-brand font-bold">Coming soon</Text>
            </View>
            <Text className="text-2xl md:text-4.5xl font-semibold">Introducing the Solid Card</Text>
          </View>

          <View className="flex-row flex-wrap gap-4 max-w-xl">
            {features.map(feature => (
              <Feature key={feature.title} {...feature} />
            ))}
          </View>

          <View className="items-start">
            <ReserveCardButton />
          </View>
        </View>
      </CardWaitlistContainer>
    </CardWaitlistHeader>
  );
};

export default CardWaitlist;
