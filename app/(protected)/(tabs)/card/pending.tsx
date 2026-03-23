import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ActivateCardHeader } from '@/components/Card/ActivateCard';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';

export default function CardPending() {
  const router = useRouter();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <ActivateCardHeader onBack={handleGoBack} />

        <View className="mb-10 mt-8">
          <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 pb-8 pt-10">
            <View className="mb-6">
              <Image
                source={getAsset('images/card-fade.png')}
                alt="Solid Card"
                style={{ width: 200, height: 200 }}
                contentFit="contain"
              />
            </View>

            <Text className="mt-2 text-2xl font-bold text-white">Your card is on its way!</Text>
            <Text className="my-3 text-center text-[#ACACAC]">
              Thanks for your submission. Your{'\n'}identity is now being verified. You will be
              {'\n'}notified by mail once you get approved
            </Text>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
