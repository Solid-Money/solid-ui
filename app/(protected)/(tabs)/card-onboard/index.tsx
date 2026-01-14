import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';

import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';
import CardWaitlistHeaderButtons from '@/components/CardWaitlist/CardWaitlistHeaderButtons';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import { CashbackIcon } from '@/components/CardWaitlist/CashbackIcon';
import GetCardButton from '@/components/CardWaitlist/GetCardButton';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { getCashbackPercentage } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

type ClassNames = {
  container?: string;
  title?: string;
  description?: string;
};

type FeatureProps = {
  icon: number | React.ReactElement;
  title: string;
  description: string | React.ReactNode;
  classNames?: ClassNames;
};

const Feature = ({ icon, title, description, classNames }: FeatureProps) => {
  return (
    <View className={cn('flex-row gap-2 md:w-[17rem] md:items-center', classNames?.container)}>
      {React.isValidElement(icon) ? (
        icon
      ) : (
        <Image source={icon} style={{ width: 50, height: 50 }} contentFit="contain" />
      )}
      <View>
        <Text className={cn('text-lg font-bold leading-5', classNames?.title)}>{title}</Text>
        {typeof description === 'string' ? (
          <Text
            className={cn('max-w-48 text-muted-foreground md:max-w-56', classNames?.description)}
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

const getFeatures = (cashbackPercentage: number) => [
  {
    icon: getAsset('images/card-global.png'),
    title: 'Global acceptance',
    description: '200M+ Visa merchants',
    classNames: {
      container: 'items-center',
    },
  },
  {
    icon: <CashbackIcon percentage={cashbackPercentage} />,
    title: 'Earn while you spend',
    description: `${Math.round(cashbackPercentage * 100)}% cashback for every purchase`,
    classNames: {
      container: 'items-center',
      description: 'max-w-full md:max-w-full',
    },
  },
  {
    icon: getAsset('images/card-safe.png'),
    title: 'Secure by design',
    description: 'Non-custodial, secured by passkeys',
  },
  {
    icon: getAsset('images/card-effortless.png'),
    title: 'Effortless setup',
    description: (
      <View>
        <Text className="text-muted-foreground">Start using instantly</Text>
        <View className="flex-row items-center gap-1.5">
          <Image
            source={getAsset('images/apple-google-pay.png')}
            alt="Apple/Google Pay"
            style={{ width: 82, height: 19 }}
            contentFit="contain"
          />
          <Text className="text-muted-foreground">support</Text>
        </View>
      </View>
    ),
  },
];

const CardWaitlist = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [cashbackPercentage, setCashbackPercentage] = useState<number>(0.03); // Default to 3%
  const { isScreenMedium } = useDimension();

  useEffect(() => {
    const checkWaitlistStatus = async () => {
      if (user?.email) {
        try {
          const [cashbackResponse] = await Promise.all([getCashbackPercentage()]);
          setCashbackPercentage(cashbackResponse.percentage);
        } catch (error) {
          console.error('Error fetching cashback:', error);
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
          <View className="md:flex-row md:items-center md:justify-between">
            <CardWaitlistHeaderTitle />
            {isScreenMedium && <CardWaitlistHeaderButtons />}
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
        <View className="flex-1 gap-8 bg-transparent p-5 py-7 pb-20 md:justify-center md:gap-14 md:px-12 md:py-10">
          <View className="items-start gap-4">
            <Text className="text-3.5xl font-semibold md:text-4.5xl">
              Introducing the Solid Card
            </Text>
          </View>

          <View className="max-w-2xl flex-row flex-wrap gap-10">
            {getFeatures(cashbackPercentage).map(feature => (
              <Feature key={feature.title} {...feature} />
            ))}
          </View>

          {!isScreenMedium && (
            <Image
              source={getAsset('images/cards.png')}
              style={{ width: 289, height: 305 }}
              contentFit="contain"
            />
          )}

          <View className="md:items-start">
            <GetCardButton />
          </View>
        </View>
      </CardWaitlistContainer>
    </CardWaitlistHeader>
  );
};

export default CardWaitlist;
