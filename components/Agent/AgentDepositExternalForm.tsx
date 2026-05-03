import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Info } from 'lucide-react-native';

import DepositPublicAddress from '@/components/DepositOption/DepositPublicAddress';
import { Text } from '@/components/ui/text';

const SUPPORTED_NETWORKS_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';
const baseIcon = require('@/assets/images/base.png');

type Props = {
  agentEoaAddress: string;
};

const AgentDepositExternalForm = ({ agentEoaAddress }: Props) => {
  return (
    <View className="flex-1 gap-4">
      <DepositPublicAddress
        address={agentEoaAddress}
        description={
          <>
            <View className="flex-row items-center justify-center gap-2">
              <Image
                source={baseIcon}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: '#1C1C1C',
                }}
                contentFit="cover"
              />
              <Text className="text-sm font-medium text-white">Base</Text>
            </View>
            <Text className="max-w-72 text-center text-sm text-muted-foreground">
              Send only USDC on Base to this address. Other tokens or chains may result in permanent
              loss of funds.
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
        }
      />

      <View className="flex-row items-start gap-2 rounded-2xl bg-primary/10 px-4 py-3">
        <Info size={16} color="#A1A1AA" />
        <Text className="flex-1 text-sm text-muted-foreground">
          Funds sent here arrive at your agent wallet immediately and do not earn yield. To keep
          earning yield on the principal, use the Borrow against savings option instead.
        </Text>
      </View>
    </View>
  );
};

export default AgentDepositExternalForm;
