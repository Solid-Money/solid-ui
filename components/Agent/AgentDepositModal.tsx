import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import useBorrowAndDepositToAgent from '@/hooks/useBorrowAndDepositToAgent';
import { getAsset } from '@/lib/assets';
import { Status } from '@/lib/types';

const SO_USD_LTV = 0.7; // mirror SO_USD_LTV in lib/utils/borrowAndBridge.ts
const MIN_BORROW_USDC = 1; // smallest amount worth a userOp + Stargate fee

const MODAL_OPEN = { name: 'agent-deposit', number: 1 } as const;
const MODAL_CLOSE = { name: 'close', number: 0 } as const;

type Props = {
  open: boolean;
  onClose: () => void;
  agentEoaAddress?: string;
};

const AgentDepositModal = ({ open, onClose, agentEoaAddress }: Props) => {
  const [amount, setAmount] = useState('');
  const { totalSupplied, totalBorrowed, isLoading: positionLoading } = useAaveBorrowPosition();
  const { borrowAndDeposit, bridgeStatus } = useBorrowAndDepositToAgent(agentEoaAddress);

  const maxBorrowable = useMemo(
    () => Math.max(0, totalSupplied * SO_USD_LTV - totalBorrowed),
    [totalSupplied, totalBorrowed],
  );

  useEffect(() => {
    if (!open) setAmount('');
  }, [open]);

  const parsedAmount = Number(amount);
  const amountValid =
    !Number.isNaN(parsedAmount) && parsedAmount >= MIN_BORROW_USDC && parsedAmount <= maxBorrowable;
  const submitting = bridgeStatus === Status.PENDING;

  const handleSubmit = async () => {
    if (!amountValid || !agentEoaAddress) return;
    try {
      await borrowAndDeposit(amount);
      Toast.show({
        type: 'success',
        text1: 'Deposit submitted',
        text2:
          'Borrowed against soUSD on Fuse and sent via Stargate. Funds arrive on Base in ~1–5 min.',
        props: { badgeText: 'Success' },
      });
      onClose();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Deposit failed',
        text2: err instanceof Error ? err.message : 'Unknown error',
        props: { badgeText: 'Error' },
      });
    }
  };

  return (
    <ResponsiveModal
      currentModal={open ? MODAL_OPEN : MODAL_CLOSE}
      previousModal={open ? MODAL_CLOSE : MODAL_OPEN}
      isOpen={open}
      onOpenChange={value => {
        if (!value && !submitting) onClose();
      }}
      trigger={null}
      title="Deposit to Agent Wallet"
      containerClassName="min-h-[42rem] overflow-y-auto flex-1"
      contentKey="agent-deposit"
    >
      <View className="gap-4">
        <Text className="font-medium opacity-50">Borrow against Savings</Text>

        {/* Amount input — same shape as Card's AmountInput */}
        <View className="gap-2">
          <Text className="font-medium opacity-50">Amount to borrow</Text>
          <View className="w-full flex-row items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-3">
            <TextInput
              keyboardType="decimal-pad"
              className="text-2xl font-semibold text-white web:w-full web:focus:outline-none"
              value={amount}
              placeholder="0.0"
              placeholderTextColor="#666"
              onChangeText={setAmount}
              editable={!submitting}
            />
            <View className="flex-row items-center gap-2">
              <Image
                source={getAsset('images/usdc-4x.png')}
                alt="USDC"
                style={{ width: 34, height: 34 }}
              />
              <Text className="text-lg font-semibold text-white">USDC</Text>
            </View>
          </View>
        </View>

        {/* Borrow position summary — mirror BalanceDisplay */}
        <View className="flex-row items-center justify-between rounded-2xl bg-accent px-5 py-4">
          <View className="gap-1">
            <Text className="text-sm opacity-50">Available to borrow</Text>
            {positionLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-xl font-semibold text-white">
                ${maxBorrowable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            )}
          </View>
          <Button
            variant="ghost"
            size="sm"
            disabled={positionLoading || submitting || maxBorrowable <= 0}
            onPress={() => setAmount(maxBorrowable.toFixed(2))}
          >
            <Text className="text-sm font-semibold opacity-70">Max</Text>
          </Button>
        </View>

        {/* Position breakdown */}
        <View className="rounded-2xl bg-accent px-5 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm opacity-50">Currently borrowed</Text>
            <Text className="text-sm font-medium text-white">
              ${totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-sm opacity-50">Supplied as collateral</Text>
            <Text className="text-sm font-medium text-white">
              ${totalSupplied.toLocaleString(undefined, { maximumFractionDigits: 2 })} soUSD
            </Text>
          </View>
        </View>

        <Button
          variant="brand"
          className="mt-2 h-12 w-full rounded-xl"
          disabled={!amountValid || submitting}
          onPress={handleSubmit}
        >
          <View className="flex-row items-center gap-2">
            {submitting ? <ActivityIndicator size="small" color="black" /> : null}
            <Text className="text-base font-bold text-primary-foreground">
              {submitting
                ? 'Borrowing + bridging…'
                : amountValid
                  ? `Borrow $${parsedAmount.toFixed(2)}`
                  : 'Enter an amount'}
            </Text>
          </View>
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default AgentDepositModal;
