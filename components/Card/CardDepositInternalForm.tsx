import { useMemo } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  useForm,
  UseFormSetValue,
  UseFormTrigger,
} from 'react-hook-form';
import { ActivityIndicator, Image, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Address, TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import { useReadContract } from 'wagmi';
import { z } from 'zod';

import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { useBalances } from '@/hooks/useBalances';
import useBridgeToCard from '@/hooks/useBridgeToCard';
import { useCardDetails } from '@/hooks/useCardDetails';
import { usePreviewDepositToCard } from '@/hooks/usePreviewDepositToCard';
import useSwapAndBridgeToCard from '@/hooks/useSwapAndBridgeToCard';
import useUser from '@/hooks/useUser';
import ERC20_ABI from '@/lib/abis/ERC20';
import { ADDRESSES } from '@/lib/config';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import { ChevronDown, Info, Leaf, Wallet as WalletIcon } from 'lucide-react-native';

type FormData = { amount: string; from: 'wallet' | 'savings' };

type SourceSelectorProps = {
  control: Control<FormData>;
  from: 'wallet' | 'savings';
};

function SourceSelector({ control, from }: SourceSelectorProps) {
  return (
    <View className="gap-2">
      <Text className="opacity-50 font-medium">From</Text>
      <Controller
        control={control}
        name="from"
        render={({ field: { onChange, value } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <View className="bg-accent rounded-2xl p-4 flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  {value === 'wallet' ? (
                    <WalletIcon color="#A1A1A1" size={24} />
                  ) : (
                    <Leaf color="#A1A1A1" size={24} />
                  )}
                  <Text className="text-lg font-semibold">
                    {value === 'wallet' ? 'Wallet' : 'Savings'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-muted-foreground">
                    {from === 'wallet' ? 'USDC.e' : 'soUSD'}
                  </Text>
                  <ChevronDown color="#A1A1A1" size={20} />
                </View>
              </View>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full min-w-[380px] border-0 rounded-t-none rounded-b-2xl -mt-4">
              <DropdownMenuItem
                onPress={() => onChange('savings')}
                className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
              >
                <Leaf color="#A1A1A1" size={20} />
                <Text className="text-lg">Savings</Text>
              </DropdownMenuItem>
              <DropdownMenuItem
                onPress={() => onChange('wallet')}
                className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
              >
                <WalletIcon color="#A1A1A1" size={20} />
                <Text className="text-lg">Wallet</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </View>
  );
}

type AmountInputProps = {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  from: 'wallet' | 'savings';
};

function AmountInput({ control, errors, from }: AmountInputProps) {
  return (
    <View className="gap-2">
      <Text className="opacity-50 font-medium">Deposit amount</Text>
      <View
        className={cn(
          'flex-row items-center justify-between gap-4 w-full bg-accent rounded-2xl px-5 py-3',
          errors.amount && 'border border-red-500',
        )}
      >
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              keyboardType="decimal-pad"
              className="w-full text-2xl text-white font-semibold web:focus:outline-none"
              value={value as any}
              placeholder="0.0"
              placeholderTextColor="#666"
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <View className="flex-row items-center gap-2">
          <Image
            source={
              from === 'wallet'
                ? require('@/assets/images/usdc-4x.png')
                : require('@/assets/images/sousd-4x.png')
            }
            alt={from === 'wallet' ? 'USDC.e' : 'soUSD'}
            style={{ width: 34, height: 34 }}
          />
          <Text className="font-semibold text-white text-lg">
            {from === 'wallet' ? 'USDC.e' : 'soUSD'}
          </Text>
        </View>
      </View>
    </View>
  );
}

type BalanceDisplayProps = {
  balanceAmount: number;
  isBalanceLoading: boolean;
  formattedBalance: string;
  setValue: UseFormSetValue<FormData>;
  trigger: UseFormTrigger<FormData>;
  from: 'wallet' | 'savings';
};

function BalanceDisplay({
  balanceAmount,
  isBalanceLoading,
  formattedBalance,
  setValue,
  trigger,
  from,
}: BalanceDisplayProps) {
  const tokenSymbol = from === 'wallet' ? 'USDC.e' : 'soUSD';

  return (
    <View className="flex-row items-center gap-2">
      <WalletIcon color="#A1A1A1" size={16} />
      {isBalanceLoading ? (
        <Skeleton className="w-20 h-5 rounded-md" />
      ) : (
        <Text className="text-muted-foreground">
          {formatNumber(balanceAmount)} {tokenSymbol}
        </Text>
      )}
      <Max
        onPress={() => {
          setValue('amount', formattedBalance);
          trigger('amount');
        }}
      />
    </View>
  );
}

type EstimatedReceiveProps = {
  estimatedUSDC: number;
  isLoading?: boolean;
};

function EstimatedReceive({ estimatedUSDC, isLoading }: EstimatedReceiveProps) {
  return (
    <View className="bg-accent/50 rounded-2xl p-4 flex-row items-center gap-3">
      <Info color="#60A5FA" size={20} />
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">You will receive (estimated)</Text>
        {isLoading ? (
          <Skeleton className="w-24 h-6 rounded-md mt-1" />
        ) : (
          <Text className="text-lg font-semibold text-white mt-0.5">
            ~{formatNumber(estimatedUSDC)} USDC
          </Text>
        )}
      </View>
    </View>
  );
}

function DestinationDisplay() {
  return (
    <View className="gap-2">
      <Text className="opacity-50 font-medium">To</Text>
      <View className="bg-accent rounded-2xl p-4 flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-semibold">Card (Arbitrum)</Text>
        </View>
        <Text className="text-sm text-muted-foreground">USDC</Text>
      </View>
    </View>
  );
}

type ErrorDisplayProps = {
  error?: string | null;
};

function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
      <Text className="text-red-500 text-sm">{error}</Text>
    </View>
  );
}

type SubmitButtonProps = {
  disabled: boolean;
  bridgeStatus: Status;
  swapAndBridgeStatus: Status;
  onPress: () => void;
};

function SubmitButton({ disabled, bridgeStatus, swapAndBridgeStatus, onPress }: SubmitButtonProps) {
  return (
    <Button variant="brand" className="rounded-2xl h-12" disabled={disabled} onPress={onPress}>
      {bridgeStatus === Status.PENDING || swapAndBridgeStatus === Status.PENDING ? (
        <ActivityIndicator color="black" />
      ) : (
        <Text className="font-semibold text-black text-lg">Deposit to Card</Text>
      )}
    </Button>
  );
}

export default function CardDepositInternalForm() {
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivity();
  const { setTransaction, setModal } = useCardDepositStore();
  const { data: cardDetails } = useCardDetails();

  // Get all token balances including soUSD
  const { tokens, isLoading: isBalancesLoading } = useBalances();

  // Get Fuse USDC.e balance
  const { data: fuseUsdcBalance, isLoading: isUsdcBalanceLoading } = useReadContract({
    abi: ERC20_ABI,
    address: USDC_STARGATE,
    functionName: 'balanceOf',
    args: [user?.safeAddress as Address],
    chainId: fuse.id,
    query: { enabled: !!user?.safeAddress },
  });

  // Get soUSD balance and rate from tokens
  const soUsdToken = useMemo(() => {
    return tokens.find(
      token =>
        token.contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase() &&
        token.chainId === fuse.id,
    );
  }, [tokens]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: { amount: '', from: 'savings' },
  });

  const watchedAmount = watch('amount');
  const watchedFrom = watch('from');

  const usdcBalanceAmount = fuseUsdcBalance ? Number(fuseUsdcBalance) / 1e6 : 0;
  const soUsdBalanceAmount = soUsdToken
    ? Number(soUsdToken.balance) / Math.pow(10, soUsdToken.contractDecimals)
    : 0;

  const balanceAmount = watchedFrom === 'wallet' ? usdcBalanceAmount : soUsdBalanceAmount;
  const isBalanceLoading = watchedFrom === 'wallet' ? isUsdcBalanceLoading : isBalancesLoading;
  const tokenSymbol = watchedFrom === 'wallet' ? 'USDC.e' : 'soUSD';
  const { amountOut: estimatedUSDC, isLoading: isEstimatedUSDCLoading } = usePreviewDepositToCard(
    watchedAmount,
    ADDRESSES.fuse.stargateOftUSDC,
  );

  const schema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} ${tokenSymbol}`,
        ),
    });
  }, [balanceAmount, tokenSymbol]);

  const formattedBalance = balanceAmount.toString();

  // Fuse bridge hook
  const { bridge, bridgeStatus, error: bridgeError } = useBridgeToCard();
  const {
    swapAndBridge,
    bridgeStatus: swapAndBridgeStatus,
    error: swapAndBridgeError,
  } = useSwapAndBridgeToCard();

  const onSubmit = async (data: any) => {
    if (!user) return;

    try {
      // Check for Arbitrum funding address
      const arbitrumFundingAddress = cardDetails?.additional_funding_instructions?.find(
        instruction => instruction.chain === 'arbitrum',
      );

      if (!arbitrumFundingAddress) {
        Toast.show({
          type: 'error',
          text1: 'Arbitrum deposits not available',
          text2: 'This card does not support Arbitrum deposits',
        });
        return;
      }

      const sourceSymbol = watchedFrom === 'savings' ? 'soUSD' : 'USDC.e';

      // Create activity event (stays PENDING until Bridge processes it)
      const clientTxId = await createActivity({
        type: TransactionType.CARD_TRANSACTION,
        title: `Card Deposit`,
        shortTitle: `Card Deposit`,
        amount: data.amount,
        symbol: sourceSymbol,
        chainId: fuse.id,
        fromAddress: user.safeAddress,
        toAddress: arbitrumFundingAddress.address,
        status: TransactionStatus.PENDING,
        metadata: {
          description: `Deposit ${data.amount} ${sourceSymbol} to card`,
          processingStatus: 'bridging',
        },
      });

      let tx: TransactionReceipt | undefined;

      if (watchedFrom === 'savings') {
        tx = await swapAndBridge(data.amount, estimatedUSDC ?? '0');
      } else {
        tx = await bridge(data.amount);
      }

      // Update activity with transaction hash, keeping it PENDING
      await updateActivity(clientTxId, {
        status: TransactionStatus.PENDING,
        hash: tx.transactionHash,
        url: `https://layerzeroscan.com/tx/${tx.transactionHash}`,
        metadata: {
          txHash: tx.transactionHash,
          processingStatus: 'awaiting_bridge',
        },
      });

      setTransaction({ amount: Number(data.amount) });
      setModal(CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
      reset();
    } catch (error) {
      console.error('Bridge error:', error);
      Toast.show({
        type: 'error',
        text1: 'Bridge failed',
        text2: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  // Dynamically apply validation
  const isValid = useMemo(() => {
    try {
      schema.parse({ amount: watchedAmount });
      return true;
    } catch {
      return false;
    }
  }, [watchedAmount, schema]);

  const disabled =
    bridgeStatus === Status.PENDING ||
    swapAndBridgeStatus === Status.PENDING ||
    isEstimatedUSDCLoading ||
    !isValid ||
    !watchedAmount;

  // Show validation error message
  const validationError = useMemo(() => {
    if (!watchedAmount) return null;
    try {
      schema.parse({ amount: watchedAmount });
      return null;
    } catch (error: any) {
      return error.errors?.[0]?.message || null;
    }
  }, [watchedAmount, schema]);

  return (
    <View className="gap-3 flex-1">
      <SourceSelector control={control} from={watchedFrom} />

      <View className="gap-2">
        <AmountInput control={control} errors={formState.errors} from={watchedFrom} />
        <BalanceDisplay
          balanceAmount={balanceAmount}
          isBalanceLoading={isBalanceLoading}
          formattedBalance={formattedBalance}
          setValue={setValue}
          trigger={trigger}
          from={watchedFrom}
        />
      </View>

      {watchedFrom === 'savings' && watchedAmount && (
        <EstimatedReceive
          estimatedUSDC={estimatedUSDC ? Number(estimatedUSDC) : 0}
          isLoading={isEstimatedUSDCLoading}
        />
      )}

      <View className="flex-1" />

      <DestinationDisplay />

      <ErrorDisplay error={validationError || bridgeError || swapAndBridgeError} />

      <SubmitButton
        disabled={disabled}
        bridgeStatus={bridgeStatus}
        swapAndBridgeStatus={swapAndBridgeStatus}
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
}
