import { Pressable, View } from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import { Address } from 'viem';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import HomeWithdraw from '@/assets/images/withdraw';
import CircleButton from '@/components/CircleButton';
import SendModal from '@/components/Send/SendModal';
import StakeModal from '@/components/Stake/StakeModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import WithdrawModal from '@/components/Withdraw/WithdrawModal';
import { isSoUSDEthereum } from '@/lib/utils';

type CoinButtonsProps = {
  contractAddress: Address;
  isWithdraw: boolean;
};

interface TriggerProps {
  icon: React.ReactNode;
  label: string;
  props?: any;
}

const Trigger = ({ icon, label, ...props }: TriggerProps) => {
  return (
    <Pressable className="items-center gap-2" {...props}>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">{icon}</View>
      <Text className="font-medium text-muted-foreground">{label}</Text>
    </Pressable>
  );
};

const CoinButtons = ({ contractAddress, isWithdraw }: CoinButtonsProps) => {
  return (
    <View className="mx-auto flex-row items-center justify-between gap-8">
      {isSoUSDEthereum(contractAddress) && (
        <StakeModal trigger={<Trigger icon={<ArrowUp color="white" />} label="Deposit" />} />
      )}

      {isWithdraw ? (
        <WithdrawModal trigger={<Trigger icon={<HomeWithdraw />} label="Withdraw" />} />
      ) : (
        <UnstakeModal trigger={<Trigger icon={<HomeWithdraw />} label="Withdraw" />} />
      )}

      <SendModal
        trigger={<CircleButton icon={HomeSend} label="Send" scale={0.9} viewBox="0 0 25 24" />}
      />

      <SwapModal
        trigger={<CircleButton icon={HomeSwap} label="Swap" scale={1} viewBox="0 0 29 28" />}
      />
    </View>
  );
};

export default CoinButtons;
