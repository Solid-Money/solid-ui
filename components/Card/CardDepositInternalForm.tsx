import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChevronDown, Info, Leaf, Wallet as WalletIcon } from 'lucide-react-native';
import { Address, erc20Abi, formatUnits, parseUnits, TransactionReceipt } from 'viem';
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
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { useActivity } from '@/hooks/useActivity';
import { useBalances } from '@/hooks/useBalances';
import useBorrowAndDepositToCard from '@/hooks/useBorrowAndDepositToCard';
import useBridgeToCard from '@/hooks/useBridgeToCard';
import { useCardDetails } from '@/hooks/useCardDetails';
import { usePreviewDepositToCard } from '@/hooks/usePreviewDepositToCard';
import useSwapAndBridgeToCard from '@/hooks/useSwapAndBridgeToCard';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber, getArbitrumFundingAddress } from '@/lib/utils';
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

  const getDisplayText = useCallback(() => {
    if (value === 'wallet') return 'Wallet';
    if (value === 'savings') return 'Savings';
    return 'Borrow against Savings';
  }, [value]);

  const getTokenSymbol = useCallback(() => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return '';
  }, [from]);

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
  const getDisplayText = useCallback(() => {
    if (value === 'wallet') return 'Wallet';
    if (value === 'savings') return 'Savings';
    return 'Borrow against Savings';
  }, [value]);

  const getTokenSymbol = useCallback(() => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return '';
  }, [from]);

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
        {showBorrowOption && (
          <DropdownMenuItem
            onPress={() => onChange('borrow')}
            className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
          >
            <Leaf color="#A1A1A1" size={20} />
            <Text className="text-lg">Borrow against Savings</Text>
          </DropdownMenuItem>
        )}
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
  onAmountEntry?: () => void;
};

function AmountInput({ control, errors, from, onAmountEntry }: AmountInputProps) {
  const getTokenImage = () => {
    if (from === 'wallet') return getAsset('images/usdc-4x.png');
    if (from === 'savings') return getAsset('images/sousd-4x.png');
    return getAsset('images/usdc-4x.png');
  };

  const getTokenSymbol = useCallback(() => {
    if (from === 'wallet') return 'USDC.e';
    if (from === 'savings') return 'soUSD';
    return 'USDC';
  }, [from]);

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
              onChangeText={text => {
                onChange(text);
                if (text.length > 0) {
                  onAmountEntry?.();
                }
              }}
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
  onMaxClick?: () => void;
};

function BalanceDisplay({
  balanceAmount,
  isBalanceLoading,
  formattedBalance,
  setValue,
  trigger,
  from,
  onMaxClick,
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
          onMaxClick?.();
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

  // Tracking refs
  const hasTrackedFormViewedRef = useRef(false);
  const hasTrackedAmountEntryRef = useRef(false);
  const sliderDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedValidationErrorRef = useRef<string | null>(null);

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
    defaultValues: { amount: '', from: 'borrow' },
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
      return soUsdBalanceAmount * exchangeRate * 0.79; // 79% of savings value
    }
    return 0;
  }, [soUsdBalanceAmount, exchangeRate]);

  // Calculate collateral required using the same formula as useBorrowAndDepositToCard
  const soUSDLTV = 70n; // 79% LTV
  const collateralRequired = useMemo(() => {
    if (watchedAmount === '' || watchedAmount === '0') {
      return 0;
    }
    if (watchedFrom === 'borrow' && watchedAmount && rate && Number(watchedAmount) > 0) {
      try {
        const borrowAmountWei = parseUnits(watchedAmount, 6);
        const supplyAmountWei = (borrowAmountWei * 100n * 1000000n) / (soUSDLTV * rate);
        return Number(formatUnits(supplyAmountWei, 6));
      } catch {
        return 0;
      }
    }
    return 0;
  }, [watchedFrom, watchedAmount, rate, soUSDLTV]);

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

  // Track form viewed (once on mount)
  useEffect(() => {
    if (!hasTrackedFormViewedRef.current) {
      hasTrackedFormViewedRef.current = true;
      track(TRACKING_EVENTS.CARD_DEPOSIT_INTERNAL_FORM_VIEWED);
    }
  }, []);

  // Track source selection changes
  const previousSourceRef = useRef<SourceType | null>(null);
  useEffect(() => {
    // Only track if the source actually changed (not on initial render)
    if (previousSourceRef.current !== null && previousSourceRef.current !== watchedFrom) {
      track(TRACKING_EVENTS.CARD_DEPOSIT_SOURCE_SELECTED, {
        source_type: watchedFrom,
        wallet_balance: usdcBalanceAmount,
        savings_balance: soUsdBalanceAmount,
        max_borrow_amount: maxBorrowAmount,
      });
    }
    previousSourceRef.current = watchedFrom;
  }, [watchedFrom, usdcBalanceAmount, soUsdBalanceAmount, maxBorrowAmount]);

  // Track amount entry started
  const trackAmountEntry = useCallback(() => {
    if (!hasTrackedAmountEntryRef.current) {
      hasTrackedAmountEntryRef.current = true;
      track(TRACKING_EVENTS.CARD_DEPOSIT_AMOUNT_ENTRY_STARTED, {
        source_type: watchedFrom,
      });
    }
  }, [watchedFrom]);

  // Track max button clicked
  const trackMaxButtonClicked = useCallback(() => {
    track(TRACKING_EVENTS.CARD_DEPOSIT_MAX_BUTTON_CLICKED, {
      source_type: watchedFrom,
      max_amount: balanceAmount,
    });
  }, [watchedFrom, balanceAmount]);

  // Track borrow slider changed (debounced)
  const trackSliderChanged = useCallback(
    (value: number) => {
      // Clear existing timer
      if (sliderDebounceTimerRef.current) {
        clearTimeout(sliderDebounceTimerRef.current);
      }
      // Set new timer with 500ms debounce
      sliderDebounceTimerRef.current = setTimeout(() => {
        track(TRACKING_EVENTS.CARD_DEPOSIT_BORROW_SLIDER_CHANGED, {
          borrow_amount: value,
          max_borrow_amount: maxBorrowAmount,
          slider_percentage: maxBorrowAmount > 0 ? (value / maxBorrowAmount) * 100 : 0,
        });
      }, 500);
    },
    [maxBorrowAmount],
  );

  // Clean up slider debounce timer on unmount
  useEffect(() => {
    return () => {
      if (sliderDebounceTimerRef.current) {
        clearTimeout(sliderDebounceTimerRef.current);
      }
    };
  }, []);

  const onBorrowAndDepositSubmit = useCallback(
    async (data: any) => {
      if (!user) return;

      // Track submission
      track(TRACKING_EVENTS.CARD_DEPOSIT_INTERNAL_SUBMITTED, {
        source_type: 'borrow',
        amount: data.amount,
        estimated_usdc_output: data.amount, // For borrow, amount is in USDC
        collateral_required: collateralRequired,
        borrow_apy: borrowAPY,
      });

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
    },
    [
      watchedFrom,
      cardDetails,
      user,
      borrowAndDeposit,
      borrowAPY,
      collateralRequired,
      createActivity,
      reset,
      setModal,
      setTransaction,
      updateActivity,
    ],
  );

  const onSubmit = useCallback(
    async (data: any) => {
      if (!user) return;

      // Track submission
      const trackingParams: Record<string, unknown> = {
        source_type: watchedFrom,
        amount: data.amount,
        estimated_usdc_output: watchedFrom === 'savings' ? estimatedUSDC : data.amount,
      };
      if (watchedFrom === 'savings') {
        trackingParams.exchange_rate = exchangeRate;
      }
      track(TRACKING_EVENTS.CARD_DEPOSIT_INTERNAL_SUBMITTED, trackingParams);

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
    },
    [
      watchedFrom,
      estimatedUSDC,
      exchangeRate,
      cardDetails,
      user,
      bridge,
      createActivity,
      reset,
      setModal,
      setTransaction,
      swapAndBridge,
      updateActivity,
    ],
  );

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

  // Track validation errors (only when error changes)
  useEffect(() => {
    if (validationError && validationError !== lastTrackedValidationErrorRef.current) {
      lastTrackedValidationErrorRef.current = validationError;
      // Determine error type
      let errorType = 'invalid_input';
      if (validationError.includes('balance') || validationError.includes('borrow amount')) {
        errorType = 'insufficient_balance';
      } else if (validationError.includes('greater than 0')) {
        errorType = 'min_amount';
      }
      track(TRACKING_EVENTS.CARD_DEPOSIT_VALIDATION_ERROR, {
        error_type: errorType,
        error_message: validationError,
        attempted_amount: watchedAmount,
        available_balance: balanceAmount,
        source_type: watchedFrom,
      });
    }
    // Reset when error clears
    if (!validationError) {
      lastTrackedValidationErrorRef.current = null;
    }
  }, [validationError, watchedAmount, balanceAmount, watchedFrom]);

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
      // Track slider change (debounced)
      trackSliderChanged(clampedValue);
    }
  };

  // Update slider when form amount changes (for manual input)
  useEffect(() => {
    if (watchedFrom === 'borrow' && watchedAmount) {
      const numValue = Number(watchedAmount);
      if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0 && numValue <= maxBorrowAmount) {
        setSliderValue(numValue);
      }
    }
  }, [watchedAmount, watchedFrom, maxBorrowAmount]);

  const showBorrowOption = true;

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
        <View className="gap-4 px-2">
          <BorrowSlider
            value={sliderValue}
            onValueChange={handleSliderChange}
            min={0}
            max={maxBorrowAmount}
          />
        </View>
      ) : (
        <View className="gap-2">
          <AmountInput
            control={control}
            errors={formState.errors}
            from={watchedFrom}
            onAmountEntry={trackAmountEntry}
          />
          <BalanceDisplay
            balanceAmount={balanceAmount}
            isBalanceLoading={isBalanceLoading}
            formattedBalance={formattedBalance}
            setValue={setValue}
            trigger={trigger}
            from={watchedFrom}
            onMaxClick={trackMaxButtonClicked}
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
              <Text className="text-base text-muted-foreground">Collateral Required</Text>
            </View>
            <View className="ml-auto flex-shrink-0 flex-row items-baseline gap-2">
              {isRateLoading || !watchedAmount ? (
                <Skeleton className="h-5 w-20 rounded-md" />
              ) : (
                <Text className="text-base font-semibold">
                  {formatNumber(collateralRequired)} soUSD
                </Text>
              )}
            </View>
          </View>
          <View className="px-5 py-6 md:p-5">
            <Pressable
              onPress={() => {
                Linking.openURL('https://help.solid.xyz');
              }}
            >
              <Text className="text-sm text-muted-foreground">
                Use your soUSD as collateral to borrow USDC and spend while earning yield.
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
