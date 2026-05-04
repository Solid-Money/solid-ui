import { ReactNode, useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';

const solidLogo = require('@/assets/images/solid-white.png');

const SUPPORTED_NETWORKS_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';

type DepositPublicAddressProps = {
  /** Override address shown in copy row and QR. Defaults to user's safe address. */
  address?: string;
  /** Custom description rendered under the QR. Replaces default supported-networks section. */
  description?: ReactNode;
  /** When provided, renders a "Done" CTA that invokes this handler. */
  onDone?: () => void;
};

const DepositPublicAddress = ({ address, description, onDone }: DepositPublicAddressProps = {}) => {
  const { user } = useUser();
  const resolvedAddress = address ?? user?.safeAddress ?? '';

  const networks = useMemo(() => {
    const displayOrder: Record<string, number> = {
      Ethereum: 1,
      Fuse: 2,
      Polygon: 3,
      Base: 4,
      Arbitrum: 5,
    };
    return Object.entries(BRIDGE_TOKENS)
      .map(([chainId, chain]) => ({
        chainId: Number(chainId),
        icon: chain.icon,
        name: chain.name,
      }))
      .sort((a, b) => (displayOrder[a.name] ?? 99) - (displayOrder[b.name] ?? 99));
  }, []);

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
            {resolvedAddress ? eclipseAddress(resolvedAddress, 6, 6) : ''}
          </Text>
          {resolvedAddress ? (
            <CopyToClipboard text={resolvedAddress} className="text-primary" />
          ) : null}
        </View>

        <View className="items-center justify-center px-4 py-4">
          <View
            className="items-center justify-center overflow-hidden rounded-xl"
            style={{ width: 200, height: 200, backgroundColor: '#181A1A' }}
          >
            {resolvedAddress ? (
              <QRCode
                value={resolvedAddress}
                size={200}
                color="white"
                backgroundColor="#181A1A"
                logo={solidLogo}
                logoSize={50}
                logoBackgroundColor="transparent"
              />
            ) : (
              <ActivityIndicator color="white" />
            )}
          </View>
        </View>

        <View className="items-center gap-2 px-4 pb-4">
          {description ? (
            description
          ) : (
            <>
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

              <Text className="max-w-72 text-center text-sm text-muted-foreground">
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
            </>
          )}
        </View>
      </View>
      <Text className="mt-4 text-sm text-muted-foreground">
        Allow 30-60 seconds for processing.
      </Text>
      {onDone ? (
        <Button variant="brand" className="mt-4 h-12 w-full rounded-2xl" onPress={onDone}>
          <Text className="text-lg font-semibold text-black">Done</Text>
        </Button>
      ) : null}
    </View>
  );
};

export default DepositPublicAddress;
