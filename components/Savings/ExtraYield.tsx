import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { DepositOptionModal } from '@/components/DepositOption';
import TooltipPopover from '@/components/Tooltip';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useTotalAPY } from '@/hooks/useAnalytics';
import Markdown from '@/components/Markdown';

const ExtraYield = () => {
  const { isScreenMedium } = useDimension();
  const { data: totalAPY } = useTotalAPY();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 pr-6 rounded-xl bg-[#3D3D3D]',
        })}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="font-semibold">Start earning</Text>
        </View>
      </View>
    );
  };

  const getImage = () => {
    return (
      <Image
        source={require('@/assets/images/three-percent.png')}
        style={{ width: 146, height: 146 }}
        contentFit="contain"
      />
    );
  };

  const tooltipContent = `
Solid Bonus Yield ft. MERKL

**$10,000 Early Adopter Pool** to early depositors during the first two months of Solid's launch. 

Rewards are claimable in the official Merkl app.

To qualify:
* Deposit at least $100 soUSD
* Rewards distributed proportionally among participants (up to $200)
* Program runs for 2 months from launch

**Protocol APY:** ${totalAPY ? totalAPY.toFixed(2) : '~12'}%
**Effective Bonus Yield:** Varies with TVL (1-4%+)

[Learn more](https://docs.solid.xyz/solid-early-adopter-bonus)
`;

  const getTooltipContent = () => {
    return (
      <>
        <Image
          source={require('@/assets/images/merkl.png')}
          style={{ width: 200, height: 50 }}
          contentFit="contain"
        />
        <Markdown value={tooltipContent} />
      </>
    );
  };

  return (
    <View className="md:flex-1 bg-card rounded-twice p-5 md:p-8 md:flex-row md:items-center justify-between gap-4">
      <View className="md:items-start gap-4">
        {isScreenMedium ? null : getImage()}
        <Text className="text-2xl leading-6 font-semibold md:max-w-72">
          Get extra 3% for your early support!
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-muted-foreground font-medium">Get +3% APY for 2 months.</Text>
          <TooltipPopover
            content={getTooltipContent()}
            classNames={{ content: 'bg-card rounded-twice p-3 pt-6' }}
          />
        </View>
        <DepositOptionModal trigger={getTrigger()} />
      </View>

      {isScreenMedium ? getImage() : null}
    </View>
  );
};

export default ExtraYield;
