import { ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface CardStatusPageProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function CardStatusPage({ title, description, children }: CardStatusPageProps) {
  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <BackButton fallbackHref="/card" />
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Solid card
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="mb-10 mt-8">
          <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 pb-8 pt-10">
            <View className="mb-6">
              <Image
                source={getAsset('images/card-fade.png')}
                alt="Solid Card"
                style={{ width: 402, height: 268 }}
                contentFit="contain"
              />
            </View>

            <Text className="mt-2 text-center text-2xl font-bold text-white">{title}</Text>
            {description ? (
              <Text className="my-3 text-center text-base leading-tight text-[#ACACAC]">
                {description}
              </Text>
            ) : null}

            {children}
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
