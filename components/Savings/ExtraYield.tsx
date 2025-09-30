import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { fuse } from 'viem/chains';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import { formatUnits } from 'viem';
import { useMemo } from 'react';

import { DepositOptionModal } from '@/components/DepositOption';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { cn, compactNumberFormat } from '@/lib/utils';
import { claimMerklRewards, getMerklRewards } from '@/lib/merkl';
import { useActivity } from '@/hooks/useActivity';

const MAX_REWARD = 200;

const ExtraYield = () => {
  const { isScreenMedium } = useDimension();
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const { trackTransaction } = useActivity();
  const hasDeposited = user?.isDeposited;

  const { data: merklRewards, isLoading: isMerklLoading } = useQuery({
    queryKey: ['merkl', user?.safeAddress],
    queryFn: () => getMerklRewards(user?.safeAddress as string, fuse.id),
    enabled: !!user?.safeAddress,
  });

  const {
    mutate: handleClaimMerklRewards,
    isPending: isClaimingMerklRewards,
    isSuccess: isClaimingMerklRewardsSuccess,
    isError: isClaimingMerklRewardsError,
  } = useMutation({
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
      const errorMessage = 'Error claiming Merkl rewards';
      console.error(errorMessage, error);
      Sentry.captureException(error, {
        tags: {
          type: errorMessage.toLowerCase().replaceAll(' ', '_'),
          userId: user?.userId,
        },
      });
      Toast.show({
        type: 'error',
        text1: errorMessage,
        text2: 'Inspect console log for more details and try again.',
        props: {
          badgeText: '',
        },
      });
    },
  });

  const totalClaimed = useMemo(() => {
    if (!merklRewards) return 0;

    let total = 0;
    for (const reward of merklRewards) {
      total += Number(reward.claimed);
    }

    total = Number(formatUnits(BigInt(total), 6));
    return total;
  }, [merklRewards]);

  const totalUnclaimed = useMemo(() => {
    if (!merklRewards) return 0;

    let total = 0;

    for (const reward of merklRewards) {
      total += Number(reward.amount);
    }

    total = Number(formatUnits(BigInt(total), 6));
    return total;
  }, [merklRewards]);

  const totalPending = useMemo(() => {
    if (!merklRewards) return 0;

    let total = 0;

    for (const reward of merklRewards) {
      total += Number(reward.pending);
    }

    total = Number(formatUnits(BigInt(total), 6));
    return total;
  }, [merklRewards]);

  const isLoading = isMerklLoading || isClaimingMerklRewards;
  const isUnclaimed = totalUnclaimed > 0;
  const isPending = totalPending > 0;
  const isMaxClaimed = totalClaimed >= MAX_REWARD;
  const isDisabled = isLoading || !isUnclaimed || isMaxClaimed;

  const formatReward = (amount: number, maximumFractionDigits = 2) => {
    if (amount > 0 && amount < Math.pow(10, -maximumFractionDigits)) {
      return `<$${Math.pow(10, -maximumFractionDigits)}`;
    }
    return `$${compactNumberFormat(amount)}`;
  }

  const getClaimText = () => {
    if (isClaimingMerklRewardsError) return 'Error claiming yield';
    if (isClaimingMerklRewardsSuccess) return 'Yield claimed';
    if (isMaxClaimed) return `Max ${formatReward(MAX_REWARD)} claimed`;
    if (isClaimingMerklRewards) return 'Claiming yield';
    if (isMerklLoading) return 'Checking yield';
    if (!isUnclaimed && isPending) return `Pending ${formatReward(totalPending)} yield`;
    if (!isUnclaimed) return 'No yield to claim';
    if (isUnclaimed) return `Claim ${formatReward(totalUnclaimed)} yield`;
    return 'Claim boosted yield';
  };

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 pr-6 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="font-semibold">Start earning</Text>
        </View>
      </View>
    );
  };

  const getClaimButton = () => {
    return (
      <Button
        variant="accent"
        className="h-12 px-6 rounded-xl"
        disabled={isDisabled}
        onPress={() => handleClaimMerklRewards()}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-semibold">{getClaimText()}</Text>
          {isLoading && <ActivityIndicator color="gray" />}
        </View>
      </Button>
    );
  };

  const getImage = () => {
    return (
      <Image
        source={require('@/assets/images/three-percent.png')}
        style={{
          width: 193,
          height: 193,
          position: isScreenMedium ? 'absolute' : 'relative',
          top: isScreenMedium ? '5%' : 0,
          right: isScreenMedium ? '5%' : 0,
        }}
        contentFit="contain"
      />
    );
  };

  return (
    <View className="md:flex-1 relative bg-card rounded-twice p-5 md:p-8 md:flex-row md:items-center justify-between gap-4">
      <View className="md:items-start gap-4">
        {isScreenMedium ? null : getImage()}
        <Text className="text-2xl leading-6 font-semibold md:max-w-72">Get 3% boosted yield!</Text>
        <View className="flex-row items-center gap-1">
          <Text
            className={cn(
              'text-muted-foreground font-medium',
              isScreenMedium ? (hasDeposited ? 'max-w-56' : 'max-w-xs') : 'max-w-full',
            )}
          >
            {hasDeposited
              ? 'Read the terms and claim your yield'
              : 'Limited time offer - Get 3% extra boosted yield if you deposit now.'}{' '}
            <Link
              href="https://docs.solid.xyz/solid-early-adopter-bonus"
              target="_blank"
              className="hover:opacity-70"
            >
              <View className="flex-row items-center">
                <Text className="underline leading-4">Read more</Text>
                <ChevronRight size={18} color="white" className="mt-0.5" />
              </View>
            </Link>
          </Text>
        </View>
        {hasDeposited ? getClaimButton() : <DepositOptionModal trigger={getTrigger()} />}
      </View>

      {isScreenMedium ? getImage() : null}
    </View>
  );
};

export default ExtraYield;
