import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import TooltipPopover from '@/components/Tooltip';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { protocols, protocolsImages } from '@/constants/protocols';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { VaultBreakdown } from '@/lib/types';
import { cn, eclipseAddress } from '@/lib/utils';

interface VaultInfoProps {
  vaultBreakdown: VaultBreakdown[];
  className?: string;
}

interface VaultBreakdownProps {
  vaultBreakdown: VaultBreakdown[];
}

const Asset = () => {
  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="font-medium text-muted-foreground md:text-lg">Base asset</Text>
        <TooltipPopover text="The primary asset denominating this pool" />
      </View>
      <View className="flex-row items-center gap-1">
        <Image
          source={getAsset('images/usdc.png')}
          style={{ width: 24, height: 24 }}
          contentFit="contain"
        />
        <Text className="text-lg font-semibold md:text-xl">USDC</Text>
      </View>
    </View>
  );
};

const Protocols = ({ vaultBreakdown }: VaultBreakdownProps) => {
  const uniqueProtocols = useMemo(() => {
    return [...new Set(vaultBreakdown.map(item => item.type))];
  }, [vaultBreakdown]);

  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="font-medium text-muted-foreground md:text-lg">Protocols</Text>
        <TooltipPopover text="DEXs and lending platforms where assets may be deployed" />
      </View>
      <View className="flex-row items-center gap-1">
        {uniqueProtocols.map((protocol, index) => (
          <TooltipPopover
            key={protocol}
            trigger={
              <View
                key={protocol}
                className="-mr-2"
                style={{
                  zIndex: index,
                }}
              >
                <Image
                  source={protocolsImages[protocol]}
                  style={{ width: 24, height: 24, borderRadius: 999 }}
                  contentFit="contain"
                />
              </View>
            }
            content={
              <Text className="text-sm">{protocols[protocol as keyof typeof protocols]}</Text>
            }
          />
        ))}
      </View>
    </View>
  );
};

const Deposit = () => {
  const { user } = useUser();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'brand',
          className: 'h-12 rounded-xl pl-4 pr-6 md:pl-8 md:pr-10',
        })}
      >
        <View className="flex-row items-center gap-1 md:gap-2.5">
          <Plus color="black" />
          <Text className="font-bold text-primary-foreground">Deposit</Text>
        </View>
      </View>
    );
  };

  if (!user) {
    return (
      <Pressable
        onPress={() => {
          router.push(path.HOME);
        }}
      >
        {getTrigger()}
      </Pressable>
    );
  }

  return <DepositOptionModal trigger={getTrigger()} />;
};

const Address = () => {
  return (
    <View className="gap-1 md:gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="font-medium text-muted-foreground md:text-lg">Vault address</Text>
        <TooltipPopover text="Address of the vault on Ethereum" />
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-lg font-semibold md:text-xl">
          {eclipseAddress(ADDRESSES.ethereum.vault)}
        </Text>
        <CopyToClipboard text={ADDRESSES.ethereum.vault} />
      </View>
    </View>
  );
};

const VaultInfo = ({ vaultBreakdown, className }: VaultInfoProps) => {
  const { isScreenMedium } = useDimension();

  if (isScreenMedium) {
    return (
      <View className={cn('flex-row items-center justify-between gap-2', className)}>
        <Asset />
        <Protocols vaultBreakdown={vaultBreakdown} />
        <Address />
        <Deposit />
      </View>
    );
  }

  return (
    <View className={cn('justify-between gap-6', className)}>
      <View className="flex-row justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Asset />
        </View>
        <View className="min-w-0 flex-1">
          <Protocols vaultBreakdown={vaultBreakdown} />
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Address />
        </View>
        <View className="min-w-0 flex-1">
          <Deposit />
        </View>
      </View>
    </View>
  );
};

export default VaultInfo;
