import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { DepositOptionModal } from '@/components/DepositOption';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { cn } from '@/lib/utils';

const ExtraYield = () => {
  const { isScreenMedium } = useDimension();
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 pr-6 rounded-xl bg-[#3D3D3D]',
        })}
      >
        <View className="flex-row items-center gap-2">
          {hasDeposited ? null : <Plus color="white" />}
          <Text className="font-semibold">
            {hasDeposited ? 'Claim boosted yield' : 'Start earning'}
          </Text>
        </View>
      </View>
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
        <DepositOptionModal trigger={getTrigger()} />
      </View>

      {isScreenMedium ? getImage() : null}
    </View>
  );
};

export default ExtraYield;
