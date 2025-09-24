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
        <TooltipPopover text="Base asset of the vault" />
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
        <TooltipPopover text="Protocols used in the vault" />
      </View>
      <View className="flex-row items-center gap-1">
        {uniqueProtocols.map(protocol => (
          <Image
            key={protocol}
            source={protocolsImages[protocol]}
            style={{ width: 24, height: 24 }}
            contentFit="contain"
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
        <TooltipPopover text="Chain of the vault" />
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
        <Text className="text-xl font-semibold">{eclipseAddress(ADDRESSES.fuse.vault)}</Text>
        <CopyToClipboard text={ADDRESSES.fuse.vault} />
      </View>
    </View>
  );
};

const VaultInfo = ({ vaultBreakdown, className }: VaultInfoProps) => {
  return (
    <View className={cn('flex-row justify-between items-center gap-2', className)}>
      <Asset />
      <Protocols vaultBreakdown={vaultBreakdown} />
      <Chain />
      <Address />
    </View>
  );
};

export default VaultInfo;
