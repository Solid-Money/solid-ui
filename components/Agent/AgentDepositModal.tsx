import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { BorrowSlider } from '@/components/Card/BorrowSlider';
import ResponsiveModal from '@/components/ResponsiveModal';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import useBorrowAndDepositToAgent from '@/hooks/useBorrowAndDepositToAgent';
import { Status } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

const SO_USD_LTV = 70n;

const MODAL_OPEN = { name: 'agent-deposit', number: 1 } as const;
const MODAL_CLOSE = { name: 'close', number: 0 } as const;

type Props = {
  open: boolean;
  onClose: () => void;
  agentEoaAddress?: string;
};

const AgentDepositModal = ({ open, onClose, agentEoaAddress }: Props) => {
  const [sliderValue, setSliderValue] = useState(0);
  const {
    totalSupplied,
    totalBorrowed,
    borrowAPY,
    isLoading: positionLoading,
  } = useAaveBorrowPosition();
  const { borrowAndDeposit, bridgeStatus } = useBorrowAndDepositToAgent(agentEoaAddress);

  // Mirror /card/details borrow form: cap at 69% of supplied minus existing
  // debt. The 69 vs 70 LTV is intentional to give a 1% safety margin against
  // rounding when the on-chain supply value is computed.
  const maxBorrowAmount = useMemo(
    () => Math.max(0, totalSupplied * 0.69 - totalBorrowed),
    [totalSupplied, totalBorrowed],
  );

  const collateralRequired = useMemo(() => {
    if (sliderValue <= 0) return 0;
    // supply = borrow * 100 / (LTV * exchangeRate). soUSD ↔ USD is ~1:1
    // for the in-modal estimate.
    return (sliderValue * 100) / Number(SO_USD_LTV);
  }, [sliderValue]);

  useEffect(() => {
    if (!open) setSliderValue(0);
  }, [open]);

  const submitting = bridgeStatus === Status.PENDING;
  const amountValid = sliderValue > 0 && sliderValue <= maxBorrowAmount;

  const handleSubmit = async () => {
    if (!amountValid || !agentEoaAddress) return;
    try {
      await borrowAndDeposit(sliderValue.toString());
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
      <View className="flex-1 gap-3">
        <View className="gap-4 px-2">
          <BorrowSlider
            value={sliderValue}
            onValueChange={setSliderValue}
            min={0}
            max={maxBorrowAmount}
          />
        </View>

        <TokenDetails className="mt-3">
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="native:text-lg text-base text-muted-foreground">Borrow rate</Text>
            <View className="ml-auto shrink-0 flex-row items-baseline gap-2">
              {positionLoading ? (
                <Skeleton className="h-5 w-16 rounded-md" />
              ) : (
                <Text className="native:text-lg text-base font-semibold">
                  {formatNumber(borrowAPY, 2)}%
                </Text>
              )}
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <View className="flex-row items-center gap-2">
              <Text className="native:text-lg text-base text-muted-foreground">
                Collateral Required
              </Text>
            </View>
            <View className="ml-auto shrink-0 flex-row items-baseline gap-2">
              {!sliderValue ? (
                <Skeleton className="h-5 w-20 rounded-md" />
              ) : (
                <Text className="native:text-lg text-base font-semibold">
                  {formatNumber(collateralRequired)} soUSD
                </Text>
              )}
            </View>
          </View>
          <View className="px-5 py-6 md:p-5">
            <Text className="native:text-base text-sm text-muted-foreground">
              Use your soUSD as collateral to borrow USDC and fund your agent wallet on Base while
              earning yield.{' '}
              <Text
                onPress={() => {
                  Linking.openURL(
                    'https://support.solid.xyz/en/articles/13545322-borrow-against-your-savings',
                  );
                }}
                className="text-base font-medium leading-5 text-[#94F27F] web:hover:opacity-70"
              >
                Learn more.
              </Text>
            </Text>
          </View>
        </TokenDetails>

        <Button
          variant="brand"
          className="h-12 rounded-2xl"
          disabled={!amountValid || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="native:text-lg text-base font-bold text-black">Deposit</Text>
          )}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default AgentDepositModal;
