import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import useBorrowAndDepositToAgent from '@/hooks/useBorrowAndDepositToAgent';
import { Status } from '@/lib/types';

const SO_USD_LTV = 0.7; // mirror SO_USD_LTV in lib/utils/borrowAndBridge.ts
const MIN_BORROW_USDC = 1; // smallest amount worth a userOp + Stargate fee

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
    <Dialog open={open} onOpenChange={isOpen => !isOpen && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Deposit to Agent Wallet</DialogTitle>
          <DialogDescription>
            Borrow USDC against your soUSD savings on Fuse and bridge it to your agent EOA on Base
            via Stargate. Idle savings keep earning yield.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-4">
          <View className="rounded-xl bg-[#262626] p-4">
            <Text className="text-xs uppercase text-white/60">Available to borrow</Text>
            {positionLoading ? (
              <ActivityIndicator size="small" color="white" className="mt-2 self-start" />
            ) : (
              <Text className="text-2xl font-semibold text-white">
                ${maxBorrowable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            )}
            <Text className="mt-1 text-xs text-white/60">
              Currently borrowed: $
              {totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 2 })} · Supplied: $
              {totalSupplied.toLocaleString(undefined, { maximumFractionDigits: 2 })} soUSD
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-xs uppercase text-white/60">Amount (USDC)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#7A7A7A"
              editable={!submitting}
              className="rounded-xl bg-[#262626] px-4 py-3 text-2xl font-semibold text-white"
            />
            <View className="flex-row justify-end">
              <Button
                variant="ghost"
                size="sm"
                onPress={() =>
                  setAmount(
                    maxBorrowable > 0 ? maxBorrowable.toFixed(2) : MIN_BORROW_USDC.toString(),
                  )
                }
                disabled={positionLoading || submitting}
              >
                <Text className="text-xs text-white/60">Max</Text>
              </Button>
            </View>
          </View>

          <Button
            variant="brand"
            className="h-12 w-full rounded-xl"
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
      </DialogContent>
    </Dialog>
  );
};

export default AgentDepositModal;
