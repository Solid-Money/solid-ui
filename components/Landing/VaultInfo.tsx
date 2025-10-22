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
        <Text className="md:text-lg text-muted-foreground font-medium">Base asset</Text>
        <TooltipPopover text="The primary asset denominating this pool" />
      </View>
      <View className="flex-row items-center gap-1">
        <Image
          source={require('@/assets/images/usdc.png')}
          style={{ width: 24, height: 24 }}
          contentFit="contain"
        />
        <Text className="text-lg md:text-xl font-semibold">USDC</Text>
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
        <Text className="md:text-lg text-muted-foreground font-medium">Protocols</Text>
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
          className: 'h-12 pl-4 pr-6 md:pl-8 md:pr-10 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-1 md:gap-2.5">
          <Plus color="black" />
          <Text className="text-primary-foreground font-bold">Deposit</Text>
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
        <Text className="md:text-lg text-muted-foreground font-medium">Vault address</Text>
        <TooltipPopover text="Address of the vault on Ethereum" />
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-lg md:text-xl font-semibold">
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
      <View className={cn('flex-row justify-between items-center gap-2', className)}>
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
        <View className="flex-1 min-w-0">
          <Asset />
        </View>
        <View className="flex-1 min-w-0">
          <Protocols vaultBreakdown={vaultBreakdown} />
        </View>
      </View>
      <View className="flex-row justify-between items-center gap-2">
        <View className="flex-1 min-w-0">
          <Address />
        </View>
        <View className="flex-1 min-w-0">
          <Deposit />
        </View>
      </View>
    </View>
  );
};

export default VaultInfo;
