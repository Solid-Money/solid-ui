import { useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import SolidQRCode from '@/components/SolidQRCode';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';

const SUPPORTED_NETWORKS_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';

const DepositPublicAddress = () => {
  const { user } = useUser();

  const networks = useMemo(
    () =>
      Object.entries(BRIDGE_TOKENS)
        .sort(([, a], [, b]) => a.sort - b.sort)
        .map(([chainId, chain]) => ({
          chainId: Number(chainId),
          icon: chain.icon,
          name: chain.name,
        })),
    [],
  );

  const networkNames = useMemo(() => {
    const names = networks.map(n => n.name);
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }, [networks]);

  return (
    <View className="flex items-center justify-center">
      <View className="w-full max-w-md rounded-xl bg-card">
        <View className="flex-row items-center justify-center gap-1 pt-4">
          <Text className="text-lg font-medium text-white">
            {user?.safeAddress ? eclipseAddress(user?.safeAddress, 6, 6) : ''}
          </Text>
          <CopyToClipboard text={user?.safeAddress || ''} className="text-primary" />
        </View>

        <View className="items-center justify-center px-4 py-4">
          <View className="overflow-hidden rounded-xl">
            <SolidQRCode value={user?.safeAddress || ''} size={200} />
          </View>
        </View>

        <View className="items-center gap-2 px-4 pb-4">
          <View className="flex-row items-center justify-center">
            {networks.map((network, index) => (
              <View
                key={network.chainId}
                className={index > 0 ? '-ml-2' : ''}
                style={{ zIndex: networks.length - index }}
              >
                <Image
                  source={network.icon}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: '#1C1C1C',
                  }}
                  contentFit="cover"
                />
              </View>
            ))}
          </View>

          <Text className="text-center text-sm text-muted-foreground">
            We support tokens on {networkNames} chain
          </Text>

          <Pressable
            onPress={() => Linking.openURL(SUPPORTED_NETWORKS_URL)}
            className="web:hover:opacity-50"
          >
            <View className="flex-row flex-wrap items-center">
              <Text className="text-sm font-medium text-white">See supported networks</Text>
              <ChevronRight size={16} color="white" />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default DepositPublicAddress;
