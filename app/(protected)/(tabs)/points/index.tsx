import PageLayout from '@/components/PageLayout';
import PointsTitle from '@/components/Points/PointsTitle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import { useDimension } from '@/hooks/useDimension';
import { useHoldingFundsPointsMultiplier } from '@/hooks/useHoldingFundsPointsMultiplier';
import { usePoints } from '@/hooks/usePoints';
import { RewardsType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ImageBackground, Platform, View } from 'react-native';

export default function Points() {
  const { points, isLoading: isPointsLoading } = usePoints();
  const { multiplier } = useHoldingFundsPointsMultiplier();
  const { isScreenMedium } = useDimension();
  const countdownTime = useCountdownTimer(points.nextRewardTime);

  const referrer = points.userRefferer;

  const depositRewards = points.userRewardsSummary.rewardsByType.find(
    r => r.type === RewardsType.DEPOSIT,
  );

  const depositPoints = depositRewards?.totalPoints || 0;

  return (
    <PageLayout isLoading={isPointsLoading}>
      <View className="mx-auto w-full max-w-7xl gap-6 px-4 pb-8 pt-4 md:gap-9 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between ">
            <PointsTitle />
          </View>
        ) : (
          <Text className="text-3xl font-semibold">Points</Text>
        )}
        <LinearGradient
          colors={['rgba(255, 209, 81, 0.25)', 'rgba(255, 209, 81, 0.17)']}
          start={{ x: 0.1965, y: 0 }}
          end={{ x: 0.7962, y: 1 }}
          className="min-h-96 overflow-hidden rounded-twice web:md:flex web:md:flex-row"
          style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
        >
          <ImageBackground
            source={require('@/assets/images/points_large.png')}
            resizeMode="contain"
            className="flex-1"
            imageStyle={{
              width: 800,
              height: 600,
              marginTop: isScreenMedium ? -120 : -120,
              marginRight: isScreenMedium ? -120 : -250,
              marginLeft: 'auto',
            }}
          >
            <View className="flex-1 justify-between gap-12 border-b border-r border-rewards/20 bg-transparent p-6 pb-16 md:gap-4 md:border-b-0 md:border-r md:px-10 md:py-8">
              <View>
                <Text className="text-rewards/70 md:text-lg">Your Total Points</Text>
                <View className="flex-row items-center">
                  {/** Used fontSize and lineHeight specifically to have 5rem as font size.*/}
                  <Text
                    className="font-semibold text-rewards"
                    style={{ fontSize: 80, lineHeight: 88 }}
                  >
                    {formatNumber(points.userRewardsSummary.totalPoints, 0, 0)}
                  </Text>
                </View>
              </View>
              <View className="flex-col gap-4">
                <View className="flex-col gap-6 md:flex-row md:gap-28">
                  <View className="gap-1">
                    <Text className="text-rewards/70 md:text-lg">From deposits</Text>
                    <View className="flex-row items-center">
                      <Text className="native:leading-[1.2] text-4xl font-semibold text-rewards md:text-4.5xl">
                        {formatNumber(depositPoints, 0, 0)}
                      </Text>
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text className="text-rewards/70 md:text-lg">From referrals</Text>
                    <View className="flex-row items-end">
                      <Text className="native:leading-[1.2] text-4xl font-semibold text-rewards md:text-4.5xl">
                        {points.userRewardsSummary.rewardsByType.find(
                          r => r.type === RewardsType.RECURRING_REFERRAL,
                        )?.totalPoints || 0}
                      </Text>
                      <Text className="ml-2 text-base text-rewards/70">
                        {points.userRewardsSummary.referredUsersCount || 0} referred |{' '}
                        {points.userRewardsSummary.referredUsersDepositedCount || 0} deposited
                      </Text>
                    </View>
                  </View>
                </View>
                {referrer && (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base text-rewards/70">
                      You were referred by: {referrer}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ImageBackground>

          <View className="flex-col justify-between bg-transparent web:md:w-80">
            <View className="p-6 md:p-7">
              <Text className="text-lg text-rewards/70">Next points drop in</Text>
              <View className="flex-row items-center gap-2">
                <Text className="mt-2 text-3xl font-semibold text-rewards">{countdownTime}</Text>
              </View>
              <Text className="mt-4 text-sm text-rewards/70">
                Earned yesterday: {formatNumber(points.pointsLast24Hours, 0, 0)} points
              </Text>
            </View>

            <View className="flex p-6 md:p-7">
              <Button
                variant="rewards"
                className={buttonVariants({
                  variant: 'rewards',
                  className: 'h-12 rounded-xl md:pr-6',
                })}
                onPress={() => router.push(path.POINTS_LEADERBOARD)}
              >
                <View className="flex-row items-center gap-4">
                  <Text className="font-bold">View Leaderboard</Text>
                </View>
              </Button>
            </View>
          </View>
        </LinearGradient>

        <View className="min-h-44 gap-6 md:flex-row">
          <View className="h-full w-full flex-1 flex-col justify-between rounded-twice bg-card p-6">
            <View className="flex-row items-center gap-2">
              <LinearGradient
                colors={['rgba(165, 84, 234, 0.25)', 'rgba(165, 84, 234, 0.17)']}
                start={{ x: 0.1965, y: 0 }}
                end={{ x: 0.7962, y: 1 }}
                className="flex h-[70px] w-[70px] items-center justify-center rounded-full md:h-[90px] md:w-[90px]"
              >
                <Text className="text-xl font-semibold text-[#C693E5] md:text-2xl">
                  {multiplier}X
                </Text>
              </LinearGradient>
              <View className="ml-2 flex-1 flex-col md:ml-5">
                <Text className="text-xl font-semibold md:text-2xl">
                  Deposit and earn points automatically
                </Text>
                <Text className="text-base text-white/70 md:text-lg">
                  Earn {multiplier} points per $1 per hour
                </Text>
              </View>
            </View>
            <Button
              variant="secondary"
              className="mt-7 h-10 rounded-xl border-0 bg-[#303030] px-6 md:h-12"
              onPress={() => {
                router.push(path.SAVINGS);
              }}
            >
              <View className="flex-row items-center gap-4">
                <Text className="font-bold">Start earning</Text>
              </View>
            </Button>
          </View>
          <View className="h-full w-full flex-1 flex-col justify-between rounded-twice bg-card p-6">
            <View className="flex-row items-center gap-2">
              <Image
                source={require('@/assets/images/refer_friend.png')}
                style={{ width: isScreenMedium ? 90 : 70, height: isScreenMedium ? 90 : 70 }}
                contentFit="contain"
              />
              <View className="ml-2 flex-1 flex-col md:ml-5">
                <Text className="text-xl font-semibold md:text-2xl">Share your referral code</Text>
                <Text className="text-base text-white/70 md:text-lg">
                  Earn 10% of their daily points.
                </Text>
              </View>
            </View>
            <Button
              variant="secondary"
              className="mt-7 h-10 rounded-xl border-0 bg-[#303030] px-6 md:h-12"
              onPress={() => {
                router.push(path.REFERRAL);
              }}
            >
              <View className="flex-row items-center gap-4">
                <Text className="font-bold">Refer a friend</Text>
              </View>
            </Button>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
