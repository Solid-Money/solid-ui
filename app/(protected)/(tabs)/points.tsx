import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
import PointsTitle from '@/components/Points/PointsTitle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import { useDimension } from '@/hooks/useDimension';
import { usePoints } from '@/hooks/usePoints';
import { RewardsType } from '@/lib/types';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Savings() {
  const { points, isLoading: isPointsLoading } = usePoints();
  const { isScreenMedium } = useDimension();
  const countdownTime = useCountdownTimer(points.nextRewardTime);

  if (isPointsLoading) {
    return <Loading />;
  }

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}
        <View className="gap-8 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto">
          {isScreenMedium ? (
            <View className="flex-row justify-between items-center mt-5">
              <PointsTitle />
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
                <ArrowLeft color="white" />
              </Pressable>
              <Text className="text-white text-xl md:text-3xl font-semibold text-center">
                Points
              </Text>
              <View className="w-10" />
            </View>
          )}
          <LinearGradient
            colors={['rgba(255, 209, 81, 0.25)', 'rgba(255, 209, 81, 0.17)']}
            start={{ x: 0.1965, y: 0 }}
            end={{ x: 0.7962, y: 1 }}
            className="web:md:flex web:md:flex-row rounded-twice overflow-hidden min-h-96"
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
              <View className="flex-1 bg-transparent p-6 pb-16 md:px-10 md:py-8 justify-between gap-12 md:gap-4 border-b border-r border-rewards/20 md:border-b-0 md:border-r">
                <View>
                  <Text className="md:text-lg text-rewards/70">Your Total Points</Text>
                  <View className="flex-row items-center">
                    <Text className="text-5xl md:text-8xl text-rewards font-semibold">
                      {points.userRewardsSummary.totalPoints}
                    </Text>
                  </View>
                </View>
                <View className="flex-col md:flex-row gap-6 md:gap-28">
                  <View className="gap-1">
                    <Text className="md:text-lg text-rewards/70">From deposits</Text>
                    <View className="flex-row items-center">
                      <Text className="text-4xl md:text-4.5xl native:leading-[1.2] text-rewards font-semibold">
                        {points.userRewardsSummary.rewardsByType.find(
                          r => r.type === RewardsType.DEPOSIT,
                        )?.totalPoints || 0}
                      </Text>
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text className="md:text-lg text-rewards/70">From referrals</Text>
                    <View className="flex-row items-end">
                      <Text className="text-4xl md:text-4.5xl native:leading-[1.2] text-rewards font-semibold">
                        {points.userRewardsSummary.rewardsByType.find(
                          r => r.type === RewardsType.REFERRAL_SIGNUP,
                        )?.totalPoints || 0}
                      </Text>
                      <Text className="text-base text-rewards/70 ml-2">
                        {points.userRewardsSummary.rewardsByType.find(
                          r => r.type === RewardsType.REFERRAL_SIGNUP,
                        )?.count || 0}{' '}
                        referred |{' '}
                        {points.userRewardsSummary.rewardsByType.find(
                          r => r.type === RewardsType.REFERRAL_SIGNUP,
                        )?.count || 0}{' '}
                        deposited
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ImageBackground>

            <View className="flex-col web:md:w-80 bg-transparent justify-between">
              <View className="p-6 md:p-7">
                <Text className="text-lg text-rewards/70">Next drop in</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-3xl text-rewards font-semibold mt-2">{countdownTime}</Text>
                </View>
                <Text className="mt-4 text-rewards/70 text-sm">
                  Earning 4 points per $1 per hour
                  <br />
                  Earned yesterday: {points.pointsLast24Hours} points
                </Text>
              </View>

              <View className="p-6 md:p-7 flex">
                <Button
                  variant="rewards"
                  className={buttonVariants({
                    variant: 'rewards',
                    className: 'h-12 md:pr-6 rounded-xl',
                  })}
                >
                  <View className="flex-row items-center gap-4">
                    <Text className="font-bold">View Leaderboard</Text>
                  </View>
                </Button>
              </View>
            </View>
          </LinearGradient>

          <View className="md:flex-row gap-10 min-h-44">
            <View className="bg-card rounded-twice p-6 justify-between w-full h-full flex-col flex-1">
              <View className="flex-row items-center gap-2">
                <LinearGradient
                  colors={['rgba(165, 84, 234, 0.25)', 'rgba(165, 84, 234, 0.17)']}
                  start={{ x: 0.1965, y: 0 }}
                  end={{ x: 0.7962, y: 1 }}
                  className="md:h-[90px] md:w-[90px] h-[70px] w-[70px] rounded-full flex justify-center items-center"
                >
                  <Text className="md:text-2xl text-xl font-semibold text-[#C693E5]">10X</Text>
                </LinearGradient>
                <View className="flex-col md:ml-5 ml-2">
                  <Text className="md:text-2xl text-xl font-semibold">
                    Deposit and earn 10x points
                  </Text>
                  <Text className="md:text-lg text-base text-white/70">
                    Earn 4 points per $1 per hour
                  </Text>
                </View>
              </View>
              <Button
                variant="secondary"
                className="md:h-12 h-10 px-6 rounded-xl bg-[#303030] border-0 mt-7"
                onPress={() => {
                  router.push(path.DEPOSIT);
                }}
              >
                <View className="flex-row items-center gap-4">
                  <Text className="font-bold">Start earning</Text>
                </View>
              </Button>
            </View>
            <View className="bg-card rounded-twice p-6 justify-between w-full h-full flex-col flex-1">
              <View className="flex-row items-center gap-2">
                <Image
                  source={require('@/assets/images/refer_friend.png')}
                  style={{ width: isScreenMedium ? 90 : 70, height: isScreenMedium ? 90 : 70 }}
                  contentFit="contain"
                />
                <View className="flex-col md:ml-5 ml-2">
                  <Text className="md:text-2xl text-xl font-semibold">Refer a Friend</Text>
                  <Text className="md:text-lg text-base text-white/70">
                    Earn 10% of their daily points.
                  </Text>
                </View>
              </View>
              <Button
                variant="secondary"
                className="md:h-12 h-10 px-6 rounded-xl bg-[#303030] border-0 mt-7"
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
      </ScrollView>
    </SafeAreaView>
  );
}
