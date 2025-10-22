import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PageLayout from '@/components/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { fetchLeaderboardUsers } from '@/lib/api';
import { LeaderboardResponse, LeaderboardUser } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';

type PositionStar = {
  name: string;
  icon: string;
};

type PositionStars = {
  [key: number]: PositionStar;
};

type RowProps = {
  leaderboardUser: LeaderboardUser;
  index: number;
  isStar?: boolean;
};

const PAGE_SIZE = 30;

const positionStars: PositionStars = {
  1: {
    name: 'Gold',
    icon: require('@/assets/images/star-gold.png'),
  },
  2: {
    name: 'Silver',
    icon: require('@/assets/images/star-silver.png'),
  },
  3: {
    name: 'Bronze',
    icon: require('@/assets/images/star-bronze.png'),
  },
};

const Row = ({ leaderboardUser, index, isStar }: RowProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <Animated.View
      entering={FadeInDown.duration(150).delay((index % PAGE_SIZE) * 100)}
      className="bg-card rounded-twice flex-row items-center gap-2.5 text-lg font-medium px-4 py-5 md:pr-10"
    >
      <View className="md:w-20 flex justify-center items-center relative">
        {isStar && (
          <Image
            source={positionStars[index + 1].icon}
            style={{ width: isScreenMedium ? 36 : 28, height: isScreenMedium ? 36 : 28 }}
            contentFit="contain"
          />
        )}
        <View
          className={cn(
            isStar
              ? 'absolute top-[53%] -translate-y-1/2'
              : 'bg-white/10 h-full px-2 rounded-twice mx-auto',
          )}
        >
          <Text className="text-lg font-semibold">{formatNumber(index + 1, 0, 0)}</Text>
        </View>
      </View>
      <View className="grow md:w-8/12">
        <Text className="hidden md:block">{leaderboardUser.walletAddress}</Text>
        <Text className="md:hidden">{eclipseAddress(leaderboardUser.walletAddress)}</Text>
      </View>
      <Text className="text-lg text-rewards font-bold">
        {formatNumber(leaderboardUser.points || 0, 0, 0)}
      </Text>
    </Animated.View>
  );
};

const Leaderboard = () => {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();

  const {
    data: leaderboardData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['leaderboard'],
    queryFn: ({ pageParam }) =>
      fetchLeaderboardUsers({
        pageSize: PAGE_SIZE.toString(),
        userIdToStartAfter: pageParam,
      }),
    getNextPageParam: (lastPage: LeaderboardResponse) =>
      lastPage.users.length > 0 ? lastPage.users[lastPage.users.length - 1].id : undefined,
    initialPageParam: undefined,
  });

  const leaderboardUsers = leaderboardData?.pages.flatMap(page => page.users) || [];

  if (!user) {
    return null;
  }

  const constructedUser: LeaderboardUser = {
    id: user.safeAddress,
    walletAddress: user.safeAddress,
    points: user.points || 0,
    leaderboardPosition: user.leaderboardPosition || 0,
  };

  const renderItem = ({ item, index }: { item: LeaderboardUser; index: number }) => (
    <View className="w-full max-w-7xl mx-auto px-4">
      <Row leaderboardUser={item} index={index} isStar={index < 3} />
    </View>
  );

  const renderLoading = () => {
    return (
      <View className="w-full max-w-7xl mx-auto px-4 mt-2.5">
        <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
      </View>
    );
  };

  const renderHeader = () => (
    <View className="gap-8 md:gap-16 px-4 w-full max-w-7xl mx-auto">
      <Text className="text-white text-xl md:text-3xl font-semibold">Points Leaderboard</Text>
      <View className="gap-10">
        <View className="gap-4">
          <Text className="text-lg font-semibold">Your Ranking</Text>
          <Row leaderboardUser={constructedUser} index={user.leaderboardPosition || 0} />
        </View>
        <View className="mb-4">
          <Text className="text-lg font-semibold">Top users of all-time</Text>
        </View>
      </View>
    </View>
  );

  return (
    <PageLayout desktopOnly scrollable={false}>
      <FlashList
        data={leaderboardUsers}
        ListEmptyComponent={renderLoading}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        estimatedItemSize={80}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={() => (isFetchingNextPage ? renderLoading() : null)}
        contentContainerStyle={{ paddingVertical: isScreenMedium ? 48 : 32 }}
      />
    </PageLayout>
  );
};

export default Leaderboard;
