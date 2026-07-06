import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins } from 'lucide-react-native';
import { fuse } from 'viem/chains';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useActivity } from '@/hooks/useActivity';
import { useRewardsUserData } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { calculateUnclaimedMerklRewards, claimMerklRewards, getMerklRewards } from '@/lib/merkl';
import { RewardsTier } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';

const YELLOW = '#ffd151';

const TIER_BOOST: Partial<Record<RewardsTier, { boost: number; name: string }>> = {
  [RewardsTier.PRIME]: { boost: 2, name: 'Prime' },
  [RewardsTier.ULTRA]: { boost: 5, name: 'Ultra' },
};

const YieldBoostBanner = () => {
  const { data: rewardsData } = useRewardsUserData();
  const tierConfig = rewardsData?.currentTier ? TIER_BOOST[rewardsData.currentTier] : undefined;

  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const { trackTransaction } = useActivity();

  const { data: merklRewards, isLoading: isMerklLoading } = useQuery({
    queryKey: ['merkl', user?.safeAddress],
    queryFn: () => getMerklRewards(user?.safeAddress as string, fuse.id),
    enabled: !!user?.safeAddress,
  });

  const totalUnclaimed = merklRewards
    ? Number(calculateUnclaimedMerklRewards(merklRewards).formatted)
    : 0;

  const { mutate: handleClaim, isPending: isClaiming } = useMutation({
    mutationFn: async () => {
      if (!user?.suborgId || !user?.signWith) {
        throw new Error('User suborgId or signWith not found');
      }
      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      await claimMerklRewards(smartAccountClient, fuse, trackTransaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merkl', user?.safeAddress] });
    },
    onError: error => {
      const errorMessage = 'Error claiming boosted yield';
      console.error(errorMessage, error);
      Sentry.captureException(error, {
        tags: { type: 'merkl_claim_banner', userId: user?.userId },
      });
      Toast.show({
        type: 'error',
        text1: errorMessage,
        text2: 'Please try again.',
        props: { badgeText: '' },
      });
    },
  });

  const isLoading = isMerklLoading || isClaiming;
  const isDisabled = isLoading || totalUnclaimed === 0;

  const getClaimText = () => {
    if (isClaiming) return 'Claiming…';
    if (isMerklLoading) return 'Checking…';
    if (totalUnclaimed > 0) return `Claim $${compactNumberFormat(totalUnclaimed)}`;
    return 'Claim boosted yield';
  };

  // if (!tierConfig) return null;

  return (
    <LinearGradient
      colors={['rgba(255,209,81,0.15)', 'rgba(255,209,81,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius: 16 }}
    >
      <View className="flex-row items-center gap-4 px-4 py-4 md:px-6 md:py-5">
        <View
          className="h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,209,81,0.15)' }}
        >
          <HandCoins color={YELLOW} size={22} />
        </View>

        <View className="flex-1 gap-0.5">
          <Text>
            <Text className="text-xl font-semibold text-foreground">{'You are receiving '}</Text>
            <Text style={{ color: YELLOW }} className="text-xl font-semibold text-foreground">
              {`${0}%`}
            </Text>
            <Text className="text-xl font-semibold text-foreground">{' yield boost'}</Text>
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-1">
            <Text className="text-base text-primary/70">
              {`Your ${'Core'} tier adds ${0}% on top of your base savings rate.`}
            </Text>
            <Link href={path.REWARDS_BENEFITS} className="hover:opacity-70">
              <Text className="text-sm font-semibold text-primary/70 web:underline">
                Read more ›
              </Text>
            </Link>
          </View>
        </View>

        <Button
          variant="rewards"
          className="h-11 shrink-0 rounded-xl"
          disabled={isDisabled}
          onPress={() => handleClaim()}
        >
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-white">{getClaimText()}</Text>
            {isLoading && <ActivityIndicator color={YELLOW} size="small" />}
          </View>
        </Button>
      </View>
    </LinearGradient>
  );
};

export default YieldBoostBanner;
