import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import CountUp from '@/components/CountUp';
import HomeCardSetup from '@/components/Home/HomeCardSetup';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';
import { fontSize } from '@/lib/utils';

interface HomeVirtualCardProps {
  userHasCard: boolean;
  cardBalance: number;
  depositCompleted: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Full-width "Virtual card" tile on the native home screen.
 *
 * - Without a card: shows the "Finish setting up" progress card (see HomeCardSetup).
 * - With a card: shows the available card balance and the Solid card artwork.
 */
const HomeVirtualCard = ({
  userHasCard,
  cardBalance,
  depositCompleted,
  isLoading,
  className,
}: HomeVirtualCardProps) => {
  const router = useRouter();

  if (!userHasCard) {
    return <HomeCardSetup depositCompleted={depositCompleted} className={className} />;
  }

  return (
    <Pressable onPress={() => router.push(path.CARD_DETAILS)} className={className}>
      <View className="overflow-hidden rounded-twice bg-card p-5">
        <Text className="text-base font-medium text-muted-foreground">Virtual card</Text>
        <View className="mt-3 flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-base font-medium text-foreground">Card balance</Text>
            {isLoading ? (
              <Skeleton className="h-9 w-28 rounded-xl" />
            ) : (
              <CountUp
                prefix="$"
                count={cardBalance ?? 0}
                isTrailingZero={false}
                decimalPlaces={2}
                classNames={{
                  wrapper: 'text-foreground',
                  decimalSeparator: 'text-2xl font-semibold',
                }}
                styles={{
                  wholeText: {
                    fontSize: fontSize(1.875),
                    fontWeight: '600',
                    fontFamily: 'MonaSans_600SemiBold',
                    color: '#ffffff',
                    marginRight: -1,
                  },
                  decimalText: {
                    fontSize: fontSize(1.875),
                    fontWeight: '600',
                    fontFamily: 'MonaSans_600SemiBold',
                    color: '#ffffff',
                  },
                }}
              />
            )}
          </View>
          <Image
            source={getAsset('images/card.png')}
            alt="Solid card"
            style={{ width: 130, height: 90 }}
            contentFit="contain"
          />
        </View>
      </View>
    </Pressable>
  );
};

export default HomeVirtualCard;
