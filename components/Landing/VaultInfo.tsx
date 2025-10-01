import { Image } from 'expo-image';
import { View } from 'react-native';
import { useMemo } from 'react';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { VaultBreakdown } from '@/lib/types';
import { protocolsImages } from '@/constants/protocols';
import { cn, eclipseAddress } from '@/lib/utils';
import { ADDRESSES } from '@/lib/config';
import CopyToClipboard from '@/components/CopyToClipboard';

interface VaultInfoProps {
  vaultBreakdown: VaultBreakdown[];
  className?: string;
}

interface VaultBreakdownProps {
  vaultBreakdown: VaultBreakdown[];
}

const Asset = () => {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg text-muted-foreground font-medium">Base asset</Text>
        <TooltipPopover text="The primary asset denominating this pool" />
      </View>
      <View className="flex-row items-center gap-1">
        <Image
          source={require('@/assets/images/usdc.png')}
          style={{ width: 24, height: 24 }}
          contentFit="contain"
        />
        <Text className="text-xl font-semibold">USDC</Text>
      </View>
    </View>
  );
};

const Protocols = ({ vaultBreakdown }: VaultBreakdownProps) => {
  const uniqueProtocols = useMemo(() => {
    return [...new Set(vaultBreakdown.map(item => item.type))];
  }, [vaultBreakdown]);

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg text-muted-foreground font-medium">Protocols</Text>
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
                  style={{ width: 24, height: 24 }}
                  contentFit="contain"
                />
              </View>
            }
            content={<Text className="text-sm">{protocol}</Text>}
          />
        ))}
      </View>
    </View>
  );
};

const Chain = () => {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg text-muted-foreground font-medium">Chain</Text>
        <TooltipPopover text="Blockchain network hosting the token" />
      </View>
      <View className="flex-row items-center gap-1">
        <Image
          source={require('@/assets/images/fuse.png')}
          style={{ width: 24, height: 24 }}
          contentFit="contain"
        />
        <Text className="text-xl font-semibold">Fuse</Text>
      </View>
    </View>
  );
};

const Address = () => {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg text-muted-foreground font-medium">Vault address</Text>
        <TooltipPopover text="Address of the vault on Ethereum" />
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-xl font-semibold">{eclipseAddress(ADDRESSES.ethereum.vault)}</Text>
        <CopyToClipboard text={ADDRESSES.ethereum.vault} />
      </View>
    </View>
  );
};

const VaultInfo = ({ vaultBreakdown, className }: VaultInfoProps) => {
  return (
    <View className={cn('md:flex-row justify-between md:items-center gap-6 md:gap-2', className)}>
      <Asset />
      <Protocols vaultBreakdown={vaultBreakdown} />
      <Chain />
      <Address />
    </View>
  );
};

export default VaultInfo;
