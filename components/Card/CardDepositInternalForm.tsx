import { useEffect, useMemo, useState } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  useForm,
  UseFormSetValue,
  UseFormTrigger,
} from 'react-hook-form';
import { ActivityIndicator, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { ChevronDown, Fuel, Info, Leaf, Wallet as WalletIcon } from 'lucide-react-native';
import { Address, erc20Abi, formatUnits, TransactionReceipt } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import Max from '@/components/Max';
import TokenDetails from '@/components/TokenCard/TokenDetails';
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
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { useActivity } from '@/hooks/useActivity';
import { useBalances } from '@/hooks/useBalances';
import useBorrowAndDepositToCard from '@/hooks/useBorrowAndDepositToCard';
import useBridgeToCard from '@/hooks/useBridgeToCard';
import { useCardDetails } from '@/hooks/useCardDetails';
import { usePreviewDepositToCard } from '@/hooks/usePreviewDepositToCard';
import useSwapAndBridgeToCard from '@/hooks/useSwapAndBridgeToCard';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import {
  cn,
  formatNumber,
  getArbitrumFundingAddress,
  isUserAllowedToUseTestFeature,
} from '@/lib/utils';
import { useCardDepositStore } from '@/store/useCardDepositStore';

import { BorrowSlider } from './BorrowSlider';

type SourceType = 'wallet' | 'savings' | 'borrow';

type FormData = { amount: string; from: SourceType };

type SourceSelectorProps = {
  control: Control<FormData>;
  from: SourceType;
  showBorrowOption: boolean;
};

function SourceSelectorNative({
  value,
  onChange,
  from,
  showBorrowOption,
}: {
  value: SourceType;
  onChange: (value: SourceType) => void;
  from: SourceType;
  showBorrowOption: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const getDisplayText = () => {
    if (value === 'wallet') return 'Wallet';
    if (value === 'savings') return 'Savings';
    return 'Borrow against Savings';
  };

  const getTokenSymbol = () => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return '';
  };

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-accent p-4"
        onPress={() => setIsOpen(!isOpen)}
      >
        <View className="flex-row items-center gap-2">
          {value === 'wallet' ? (
            <WalletIcon color="#A1A1A1" size={24} />
          ) : value === 'savings' ? (
            <Leaf color="#A1A1A1" size={24} />
          ) : (
            <Leaf color="#A1A1A1" size={24} />
          )}
          <Text className="text-lg font-semibold">{getDisplayText()}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {value !== 'borrow' && (
            <Text className="text-sm text-muted-foreground">{getTokenSymbol()}</Text>
          )}
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-accent">
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => {
              onChange('savings');
              setIsOpen(false);
            }}
          >
            <Leaf color="#A1A1A1" size={20} />
            <Text className="text-lg">Savings</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => {
              onChange('wallet');
              setIsOpen(false);
            }}
          >
            <WalletIcon color="#A1A1A1" size={20} />
            <Text className="text-lg">Wallet</Text>
          </Pressable>
          {showBorrowOption && (
            <Pressable
              className="flex-row items-center gap-2 px-4 py-3"
              onPress={() => {
                onChange('borrow');
                setIsOpen(false);
              }}
            >
              <Leaf color="#A1A1A1" size={20} />
              <Text className="text-lg">Borrow against Savings</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function SourceSelectorWeb({
  value,
  onChange,
  from,
  showBorrowOption,
}: {
  value: SourceType;
  onChange: (value: SourceType) => void;
  from: SourceType;
  showBorrowOption: boolean;
}) {
  const getDisplayText = () => {
    if (value === 'wallet') return 'Wallet';
    if (value === 'savings') return 'Savings';
    return 'Borrow against Savings';
  };

  const getTokenSymbol = () => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return '';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            {value === 'wallet' ? (
              <WalletIcon color="#A1A1A1" size={24} />
            ) : value === 'savings' ? (
              <Leaf color="#A1A1A1" size={24} />
            ) : (
              <Leaf color="#A1A1A1" size={24} />
            )}
            <Text className="text-lg font-semibold">{getDisplayText()}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted-foreground">{getTokenSymbol()}</Text>
            <ChevronDown color="#A1A1A1" size={20} />
          </View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0">
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
        {showBorrowOption && (
          <DropdownMenuItem
            onPress={() => onChange('borrow')}
            className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
          >
            <Leaf color="#A1A1A1" size={20} />
            <Text className="text-lg">Borrow against Savings</Text>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SourceSelector({ control, from, showBorrowOption }: SourceSelectorProps) {
  return (
    <View className="gap-2">
      <Text className="font-medium opacity-50">From</Text>
      <Controller
        control={control}
        name="from"
        render={({ field: { onChange, value } }) =>
          Platform.OS === 'web' ? (
            <SourceSelectorWeb
              value={value}
              onChange={onChange}
              from={from}
              showBorrowOption={showBorrowOption}
            />
          ) : (
            <SourceSelectorNative
              value={value}
              onChange={onChange}
              from={from}
              showBorrowOption={showBorrowOption}
            />
          )
        }
      />
    </View>
  );
}

type AmountInputProps = {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  from: SourceType;
};

function AmountInput({ control, errors, from }: AmountInputProps) {
  const getTokenImage = () => {
    if (from === 'wallet') return getAsset('images/usdc-4x.png');
    if (from === 'savings') return getAsset('images/sousd-4x.png');
    return getAsset('images/usdc-4x.png');
  };

  const getTokenSymbol = () => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return 'USDC';
  };

  return (
    <View className="gap-2">
      <Text className="font-medium opacity-50">
        {from === 'borrow' ? 'Amount to borrow' : 'Deposit amount'}
      </Text>
      <View
        className={cn(
          'w-full flex-row items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-3',
          errors.amount && 'border border-red-500',
        )}
      >
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              keyboardType="decimal-pad"
              className="text-2xl font-semibold text-white web:w-full web:focus:outline-none"
              value={value as any}
              placeholder="0.0"
              placeholderTextColor="#666"
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <View className="native:shrink-0 flex-row items-center gap-2">
          <Image
            source={getTokenImage()}
            alt={getTokenSymbol()}
            style={{ width: 34, height: 34 }}
          />
          <Text className="text-lg font-semibold text-white">{getTokenSymbol()}</Text>
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
  from: SourceType;
};

function BalanceDisplay({
  balanceAmount,
  isBalanceLoading,
  formattedBalance,
  setValue,
  trigger,
  from,
}: BalanceDisplayProps) {
  const tokenSymbol = useMemo(() => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return 'USDC';
  }, [from]);

  if (from === 'borrow') {
    return null;
  }

  return (
    <View className="flex-row items-center gap-2">
      <WalletIcon color="#A1A1A1" size={16} />
      {isBalanceLoading ? (
        <Skeleton className="h-5 w-20 rounded-md" />
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
    <View className="flex-row items-center gap-3 rounded-2xl bg-accent/50 p-4">
      <Info color="#60A5FA" size={20} />
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">You will receive (estimated)</Text>
        {isLoading ? (
          <Skeleton className="mt-1 h-6 w-24 rounded-md" />
        ) : (
          <Text className="mt-0.5 text-lg font-semibold text-white">
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
      <Text className="font-medium opacity-50">To</Text>
      <View className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
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
    <View className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
      <Text className="text-sm text-red-500">{error}</Text>
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
    <Button variant="brand" className="h-12 rounded-2xl" disabled={disabled} onPress={onPress}>
      {bridgeStatus === Status.PENDING || swapAndBridgeStatus === Status.PENDING ? (
        <ActivityIndicator color="black" />
      ) : (
        <Text className="text-lg font-semibold text-black">Deposit to Card</Text>
      )}
    </Button>
  );
}

function BorrowAndDepositButton({
  disabled,
  bridgeStatus,
  swapAndBridgeStatus,
  onPress,
}: SubmitButtonProps) {
  return (
    <Button variant="brand" className="h-12 rounded-2xl" disabled={disabled} onPress={onPress}>
      {bridgeStatus === Status.PENDING || swapAndBridgeStatus === Status.PENDING ? (
        <ActivityIndicator color="black" />
      ) : (
        <Text className="text-lg font-semibold text-black">Deposit</Text>
      )}
    </Button>
  );
}

export default function CardDepositInternalForm() {
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivity();
  const { setTransaction, setModal } = useCardDepositStore(
    useShallow(state => ({
      setTransaction: state.setTransaction,
      setModal: state.setModal,
    })),
  );
  const { data: cardDetails } = useCardDetails();

  // Get all token balances including soUSD
  const { tokens, isLoading: isBalancesLoading } = useBalances();

  // Get Fuse USDC.e balance
  const { data: fuseUsdcBalance, isLoading: isUsdcBalanceLoading } = useReadContract({
    abi: erc20Abi,
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

  // Get borrow rate from accountant contract
  const ACCOUNTANT_ABI = [
    {
      inputs: [],
      name: 'getRate',
      outputs: [
        {
          internalType: 'uint256',
          name: 'rate',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const { data: rate, isLoading: isRateLoading } = useReadContract({
    address: ADDRESSES.ethereum.accountant,
    abi: ACCOUNTANT_ABI,
    functionName: 'getRate',
    chainId: mainnet.id,
  });

  // Get borrow APY from Aave
  const { borrowAPY, isLoading: isBorrowAPYLoading } = useAaveBorrowPosition();

  const usdcBalanceAmount = fuseUsdcBalance ? Number(fuseUsdcBalance) / 1e6 : 0;
  const soUsdBalanceAmount = soUsdToken
    ? Number(soUsdToken.balance) / Math.pow(10, soUsdToken.contractDecimals)
    : 0;

  const balanceAmount = watchedFrom === 'wallet' ? usdcBalanceAmount : soUsdBalanceAmount;
  const isBalanceLoading = watchedFrom === 'wallet' ? isUsdcBalanceLoading : isBalancesLoading;
  const tokenSymbol =
    watchedFrom === 'wallet' ? 'USDC.e' : watchedFrom === 'savings' ? 'soUSD' : 'USDC';

  // Calculate borrow rate and max borrow amount
  const exchangeRate = rate ? Number(formatUnits(rate, 6)) : 0;
  const maxBorrowAmount = useMemo(() => {
    if (soUsdBalanceAmount > 0 && exchangeRate > 0) {
      return soUsdBalanceAmount * exchangeRate * 0.8; // 70% of savings value
    }
    return 0;
  }, [soUsdBalanceAmount, exchangeRate]);

  const { amountOut: estimatedUSDC, isLoading: isEstimatedUSDCLoading } = usePreviewDepositToCard(
    watchedFrom === 'borrow' ? watchedAmount : watchedAmount,
    ADDRESSES.fuse.stargateOftUSDC,
  );

  const schema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(
          val => {
            if (watchedFrom === 'borrow') {
              return Number(val) <= maxBorrowAmount;
            }
            return Number(val) <= balanceAmount;
          },
          {
            error:
              watchedFrom === 'borrow'
                ? `Maximum borrow amount is ${formatNumber(maxBorrowAmount)} USDC`
                : `Available balance is ${formatNumber(balanceAmount)} ${tokenSymbol}`,
          },
        ),
    });
  }, [balanceAmount, tokenSymbol, watchedFrom, maxBorrowAmount]);

  const formattedBalance = balanceAmount.toString();

  // Fuse bridge hook
  const { bridge, bridgeStatus, error: bridgeError } = useBridgeToCard();
  const {
    swapAndBridge,
    bridgeStatus: swapAndBridgeStatus,
    error: swapAndBridgeError,
  } = useSwapAndBridgeToCard();

  const { borrowAndDeposit, bridgeStatus: borrowAndDepositStatus } = useBorrowAndDepositToCard();

  const onBorrowAndDepositSubmit = async (data: any) => {
    if (!user) return;

    try {
      // Check for Arbitrum funding address
      if (!cardDetails) {
        Toast.show({
          type: 'error',
          text1: 'Card details not found',
          text2: 'Please try again later',
        });
        return;
      }
      const arbitrumFundingAddress = getArbitrumFundingAddress(cardDetails);

      if (!arbitrumFundingAddress) {
        Toast.show({
          type: 'error',
          text1: 'Arbitrum deposits not available',
          text2: 'This card does not support Arbitrum deposits',
        });
        return;
      }

      const sourceSymbol =
        watchedFrom === 'savings' ? 'soUSD' : watchedFrom === 'borrow' ? 'USDC' : 'USDC.e';

      // Create activity event (stays PENDING until Bridge processes it)
      const clientTxId = await createActivity({
        type: TransactionType.CARD_TRANSACTION,
        title: `Card Deposit`,
        shortTitle: `Card Deposit`,
        amount: data.amount,
        symbol: sourceSymbol,
        chainId: fuse.id,
        fromAddress: user.safeAddress,
        toAddress: arbitrumFundingAddress,
        status: TransactionStatus.PENDING,
        metadata: {
          description: `Deposit ${data.amount} ${sourceSymbol} to card`,
          processingStatus: 'bridging',
        },
      });

      let tx: TransactionReceipt | undefined;

      tx = await borrowAndDeposit(data.amount);

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

  const onSubmit = async (data: any) => {
    if (!user) return;

    try {
      // Check for Arbitrum funding address
      if (!cardDetails) {
        Toast.show({
          type: 'error',
          text1: 'Card details not found',
          text2: 'Please try again later',
        });
        return;
      }
      const arbitrumFundingAddress = getArbitrumFundingAddress(cardDetails);

      if (!arbitrumFundingAddress) {
        Toast.show({
          type: 'error',
          text1: 'Arbitrum deposits not available',
          text2: 'This card does not support Arbitrum deposits',
        });
        return;
      }

      const sourceSymbol =
        watchedFrom === 'savings' ? 'soUSD' : watchedFrom === 'borrow' ? 'USDC' : 'USDC.e';

      // Create activity event (stays PENDING until Bridge processes it)
      const clientTxId = await createActivity({
        type: TransactionType.CARD_TRANSACTION,
        title: `Card Deposit`,
        shortTitle: `Card Deposit`,
        amount: data.amount,
        symbol: sourceSymbol,
        chainId: fuse.id,
        fromAddress: user.safeAddress,
        toAddress: arbitrumFundingAddress,
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
    (watchedFrom !== 'borrow' && isEstimatedUSDCLoading) ||
    (watchedFrom === 'borrow' && isRateLoading) ||
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

  // Slider value for borrow option - initialize to 0 or current amount
  const [sliderValue, setSliderValue] = useState(() => {
    if (watchedFrom === 'borrow' && watchedAmount) {
      const numValue = Number(watchedAmount);
      return !isNaN(numValue) && isFinite(numValue) && numValue >= 0 ? numValue : 0;
    }
    return 0;
  });

  // Update form amount when slider changes
  const handleSliderChange = (value: number) => {
    const numValue = Number(value);
    if (isNaN(numValue) || !isFinite(numValue)) return;
    const clampedValue = Math.max(0, Math.min(maxBorrowAmount || 0, numValue));
    if (!isNaN(clampedValue) && isFinite(clampedValue)) {
      setSliderValue(clampedValue);
      setValue('amount', clampedValue.toString());
      trigger('amount');
    }
  };

  // Reset slider when switching away from borrow mode or initialize when switching to borrow
  useEffect(() => {
    if (watchedFrom !== 'borrow') {
      setSliderValue(0);
    } else if (watchedFrom === 'borrow' && maxBorrowAmount > 0) {
      // Only initialize if value is 0 or invalid
      const currentValue = Number(watchedAmount || sliderValue);
      if (currentValue === 0 || isNaN(currentValue) || !isFinite(currentValue)) {
        // Initialize to 10% of max or minimum of 10
        const initialValue = Math.max(10, Math.min(maxBorrowAmount * 0.1, maxBorrowAmount));
        if (!isNaN(initialValue) && isFinite(initialValue) && initialValue > 0) {
          setSliderValue(initialValue);
          setValue('amount', initialValue.toString());
        }
      }
    }
  }, [watchedFrom, maxBorrowAmount, watchedAmount, sliderValue, setValue]);

  // Update slider when form amount changes (for manual input)
  useEffect(() => {
    if (watchedFrom === 'borrow' && watchedAmount) {
      const numValue = Number(watchedAmount);
      if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0 && numValue <= maxBorrowAmount) {
        setSliderValue(numValue);
      }
    }
  }, [watchedAmount, watchedFrom, maxBorrowAmount]);

  const showBorrowOption = isUserAllowedToUseTestFeature(user?.username ?? '');

  // Reset to 'savings' if user is on 'borrow' but doesn't have permission
  useEffect(() => {
    if (watchedFrom === 'borrow' && !showBorrowOption) {
      setValue('from', 'savings');
      setValue('amount', '');
    }
  }, [showBorrowOption, watchedFrom, setValue]);

  return (
    <View className="flex-1 gap-3">
      <SourceSelector control={control} from={watchedFrom} showBorrowOption={showBorrowOption} />

      {watchedFrom === 'borrow' ? (
        <View className="gap-4">
          <BorrowSlider
            value={sliderValue}
            onValueChange={handleSliderChange}
            min={0}
            max={maxBorrowAmount}
          />
        </View>
      ) : (
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
      )}

      {watchedFrom === 'savings' && watchedAmount && (
        <EstimatedReceive
          estimatedUSDC={estimatedUSDC ? Number(estimatedUSDC) : 0}
          isLoading={isEstimatedUSDCLoading}
        />
      )}

      {watchedFrom === 'borrow' && (
        <TokenDetails>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Borrow rate</Text>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              {isBorrowAPYLoading ? (
                <Skeleton className="h-5 w-16 rounded-md" />
              ) : (
                <Text className="text-base font-semibold">{formatNumber(borrowAPY, 2)}%</Text>
              )}
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <View className="flex-row items-center gap-2">
              <Fuel size={16} color="#A1A1AA" />
              <Text className="text-base text-muted-foreground">Fee</Text>
            </View>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              <Text className="text-base font-semibold">0 USDC</Text>
            </View>
          </View>
          <View className="px-5 py-6 md:p-5">
            <Pressable
              onPress={() => {
                Linking.openURL('https://help.solid.xyz');
              }}
            >
              <Text className="text-center text-sm text-muted-foreground">
                Read more about terms & rates
              </Text>
            </Pressable>
          </View>
        </TokenDetails>
      )}

      <View className="flex-1" />

      {watchedFrom !== 'borrow' && <DestinationDisplay />}

      <ErrorDisplay error={validationError || bridgeError || swapAndBridgeError} />

      {watchedFrom === 'borrow' ? (
        <BorrowAndDepositButton
          disabled={disabled || borrowAndDepositStatus === Status.PENDING}
          bridgeStatus={borrowAndDepositStatus}
          swapAndBridgeStatus={borrowAndDepositStatus}
          onPress={handleSubmit(onBorrowAndDepositSubmit)}
        />
      ) : (
        <SubmitButton
          disabled={disabled}
          bridgeStatus={bridgeStatus}
          swapAndBridgeStatus={swapAndBridgeStatus}
          onPress={handleSubmit(onSubmit)}
        />
      )}
    </View>
  );
}
