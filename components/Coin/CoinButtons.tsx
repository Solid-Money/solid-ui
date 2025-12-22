import { useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUp, Minus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Address } from 'viem';

import CircleButton from '@/components/CircleButton';
import SendModal from '@/components/Send/SendModal';
import StakeModal from '@/components/Stake/StakeModal';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import WithdrawModal from '@/components/Withdraw/WithdrawModal';
import { path } from '@/constants/path';
import { isSoUSDEthereum, isSoUSDFuse } from '@/lib/utils';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';

type CoinButtonsProps = {
  contractAddress: Address;
};

interface TriggerProps {
  icon: React.ReactNode;
  label: string;
  props?: any;
}

const Trigger = ({ icon, label, ...props }: TriggerProps) => {
  return (
    <Pressable className="items-center gap-2" {...props}>
      <View className="h-14 w-14 rounded-full items-center justify-center bg-accent">{icon}</View>
      <Text className="text-muted-foreground font-medium">{label}</Text>
    </Pressable>
  );
};

const CoinButtons = ({ contractAddress }: CoinButtonsProps) => {
  const router = useRouter();

  return (
    <View className="flex-row justify-between gap-8 items-center mx-auto">
      {isSoUSDFuse(contractAddress) ? (
        <UnstakeModal
          trigger={<Trigger icon={<ArrowDownLeft color="white" />} label="Withdraw" />}
        />
      ) : (
        isSoUSDEthereum(contractAddress) && (
          <>
            <WithdrawModal trigger={<Trigger icon={<Minus color="white" />} label="Withdraw" />} />
            <StakeModal trigger={<Trigger icon={<ArrowUp color="white" />} label="Deposit" />} />
          </>
        )
      )}

      <SendModal
        trigger={<CircleButton icon={HomeSend} label="Send" scale={0.9} viewBox="0 0 25 24" />}
      />

      <CircleButton
        icon={HomeSwap}
        label="Swap"
        onPress={() => router.push(path.SWAP)}
        scale={1}
        viewBox="0 0 29 28"
      />
    </View>
  );
};

export default CoinButtons;
