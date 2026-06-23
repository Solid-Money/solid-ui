import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import CountUp from '@/components/CountUp';
import HomeCardSetup from '@/components/Home/HomeCardSetup';
import { HOME_STAT_VALUE_TEXT_STYLE } from '@/components/Home/homeStatValueStyle';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';

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
  const hasFractionalCardBalance = Math.round((cardBalance ?? 0) * 100) % 100 !== 0;

  if (!userHasCard) {
    return <HomeCardSetup depositCompleted={depositCompleted} className={className} />;
  }

  return (
    <Pressable onPress={() => router.push(path.CARD_DETAILS)} className={className}>
      <View className="relative overflow-hidden rounded-twice bg-card" style={{ height: 141 }}>
        <Text
          className="absolute font-medium text-muted-foreground"
          style={{ fontSize: 14, left: 20, lineHeight: 15.4, top: 24 }}
        >
          Virtual card
        </Text>
        <Image
          source={getAsset('images/card.png')}
          alt="Solid card"
          style={{ height: 68, position: 'absolute', right: 28, top: 36, width: 116 }}
          contentFit="contain"
        />
        <Text
          className="absolute font-semibold text-foreground"
          style={{ fontSize: 18, left: 20, lineHeight: 21.6, top: 52 }}
        >
          Card balance
        </Text>
        <View className="absolute left-5" style={{ top: 72 }}>
          {isLoading ? (
            <Skeleton className="h-10 w-24 rounded-xl" />
          ) : (
            <CountUp
              prefix="$"
              count={cardBalance ?? 0}
              isTrailingZero={false}
              decimalPlaces={hasFractionalCardBalance ? 2 : 0}
              classNames={{
                wrapper: 'text-foreground',
              }}
              styles={{
                wholeText: HOME_STAT_VALUE_TEXT_STYLE,
                decimalText: HOME_STAT_VALUE_TEXT_STYLE,
                decimalSeparator: HOME_STAT_VALUE_TEXT_STYLE,
              }}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default HomeVirtualCard;
