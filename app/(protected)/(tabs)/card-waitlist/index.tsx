import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import Checkmark from '@/assets/images/checkmark';
import CardWaitlistBackButton from '@/components/CardWaitlist/CardWaitlistBackButton';
import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';
import CardWaitlistHeaderButtons from '@/components/CardWaitlist/CardWaitlistHeaderButtons';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import ReserveCardButton from '@/components/CardWaitlist/ReserveCardButton';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { checkCardWaitlistStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

type ClassNames = {
  title?: string;
  description?: string;
};

type FeatureProps = {
  icon: string;
  title: string;
  description: string | React.ReactNode;
  classNames?: ClassNames;
};

const Feature = ({ icon, title, description, classNames }: FeatureProps) => {
  return (
    <View className="flex-row items-center gap-2 w-[17rem]">
      <Image source={icon} style={{ width: 50, height: 50 }} contentFit="contain" />
      <View>
        <Text className={cn('md:text-lg leading-5 font-bold', classNames?.title)}>{title}</Text>
        {typeof description === 'string' ? (
          <Text
            className={cn(
              'text-sm md:text-base text-muted-foreground max-w-40 md:max-w-56',
              classNames?.description,
            )}
          >
            {description}
          </Text>
        ) : (
          description
        )}
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
    description: '2% cashback for every purchase',
    classNames: {
      description: 'md:max-w-full',
    },
  },
  {
    icon: require('@/assets/images/card-safe.png'),
    title: 'Safe by design',
    description: 'Non-custodial, secured by passkeys',
  },
  {
    icon: require('@/assets/images/card-effortless.png'),
    title: 'Effortless setup',
    description: (
      <View>
        <Text className="text-sm md:text-base text-muted-foreground">Start using instantly.</Text>
        <View className="flex-row items-center gap-1.5">
          <Image
            source={require('@/assets/images/apple-google-pay.png')}
            alt="Apple/Google Pay"
            style={{ width: 82, height: 19 }}
            contentFit="contain"
          />
          <Text className="text-sm md:text-base text-muted-foreground">support</Text>
        </View>
      </View>
    ),
  },
];

const CardWaitlist = () => {
  const { user } = useUser();
  const [isInWaitlist, setIsInWaitlist] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkWaitlistStatus = async () => {
      if (user?.email) {
        try {
          const response = await checkCardWaitlistStatus(user.email);
          setIsInWaitlist(response.isInWaitlist);
        } catch (error) {
          console.error('Error checking waitlist status:', error);
        }
      }
      setLoading(false);
    };

    checkWaitlistStatus();
  }, [user?.email]);

  if (loading) {
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
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#94F27F" />
          </View>
        </CardWaitlistContainer>
      </CardWaitlistHeader>
    );
  }

  if (isInWaitlist) {
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
  }

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
