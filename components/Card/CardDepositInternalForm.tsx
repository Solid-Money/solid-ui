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
import {
  ChevronDown,
  ChevronRight,
  Fuel,
  Info,
  Leaf,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { Address, erc20Abi, formatUnits, TransactionReceipt } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import DepositPublicAddress from '@/components/DepositOption/DepositPublicAddress';
import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletTokenButton } from '@/components/WalletTokenSelector';
import { USDC_STARGATE } from '@/constants/addresses';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { useBalances } from '@/hooks/useBalances';
import useBridgeToCard from '@/hooks/useBridgeToCard';
import { useCardContracts } from '@/hooks/useCardContracts';
import useCardDeposit from '@/hooks/useCardDeposit';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import useDepositFromSolidUsdc from '@/hooks/useDepositFromSolidUsdc';
import { usePreviewDepositToCard } from '@/hooks/usePreviewDepositToCard';
import useSwapAndBridgeToCard from '@/hooks/useSwapAndBridgeToCard';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import {
  ADDRESSES,
  EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
  EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
  isProduction,
} from '@/lib/config';
import {
  CardProvider,
  DepositCategory,
  Status,
  TokenBalance,
  TokenType,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import {
  cn,
  formatNumber,
  getCardDepositTokenAddress,
  getCardDepositTokenSymbol,
  getCardFundingAddress,
} from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { CardDepositSource, useCardDepositStore } from '@/store/useCardDepositStore';
import { useDepositStore } from '@/store/useDepositStore';

const BASE_USDC_TOKEN_URL = `https://basescan.org/token/${ADDRESSES.base.usdc}`;

type FormData = { amount: string; from: CardDepositSource };

type SourceSelectorProps = {
  control: Control<FormData>;
  from: CardDepositSource;
  /** Funding sources to list, already ordered (funded source first). */
  sources: CardDepositSource[];
  /** Symbol for Wallet source (e.g. USDC.e or rUSD). */
  walletTokenSymbol: string;
};

/** Display labels for each funding source shown in the selector. */
const SOURCE_LABELS: Record<CardDepositSource, string> = {
  [CardDepositSource.WALLET]: 'Wallet',
  [CardDepositSource.SAVINGS]: 'Savings',
  [CardDepositSource.BORROW]: 'Borrow against Savings',
  [CardDepositSource.EXTERNAL]: 'External Wallet',
  [CardDepositSource.COLLATERAL]: 'Collateral',
};

/** Renders the icon associated with a funding source. */
function SourceIcon({ source, size }: { source: CardDepositSource; size: number }) {
  if (source === CardDepositSource.SAVINGS) {
    return <Leaf color="#A1A1A1" size={size} />;
  }
  return <WalletIcon color="#A1A1A1" size={size} />;
}

function SourceSelectorNative({
  value,
  onChange,
  from,
  sources,
  walletTokenSymbol,
}: {
  value: CardDepositSource;
  onChange: (value: CardDepositSource) => void;
  from: CardDepositSource;
  sources: CardDepositSource[];
  walletTokenSymbol: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const getDisplayText = useCallback(() => SOURCE_LABELS[value], [value]);

  const getTokenSymbol = useCallback(() => {
    if (from === CardDepositSource.WALLET) return walletTokenSymbol;
    if (from === CardDepositSource.SAVINGS) return 'soUSD';
    if (from === CardDepositSource.EXTERNAL) return 'USDC';
    return '';
  }, [from, walletTokenSymbol]);

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-accent p-4"
        onPress={() => setIsOpen(!isOpen)}
      >
        <View className="flex-row items-center gap-2">
          <SourceIcon source={value} size={24} />
          <Text className="text-lg font-semibold">{getDisplayText()}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">{getTokenSymbol()}</Text>
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-accent">
          {sources.map(source => (
            <Pressable
              key={source}
              className="flex-row items-center gap-2 px-4 py-3"
              onPress={() => {
                onChange(source);
                setIsOpen(false);
              }}
            >
              <SourceIcon source={source} size={20} />
              <Text className="text-lg">{SOURCE_LABELS[source]}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SourceSelectorWeb({
  value,
  onChange,
  from,
  sources,
  walletTokenSymbol,
}: {
  value: CardDepositSource;
  onChange: (value: CardDepositSource) => void;
  from: CardDepositSource;
  sources: CardDepositSource[];
  walletTokenSymbol: string;
}) {
  const getDisplayText = useCallback(() => SOURCE_LABELS[value], [value]);

  const getTokenSymbol = useCallback(() => {
    if (from === CardDepositSource.WALLET) return walletTokenSymbol;
    if (from === CardDepositSource.SAVINGS) return 'soUSD';
    if (from === CardDepositSource.EXTERNAL) return 'USDC';
    return '';
  }, [from, walletTokenSymbol]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            <SourceIcon source={value} size={24} />
            <Text className="text-lg font-semibold">{getDisplayText()}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted-foreground">{getTokenSymbol()}</Text>
            <ChevronDown color="#A1A1A1" size={20} />
          </View>
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0">
        {sources.map(source => (
          <DropdownMenuItem
            key={source}
            onPress={() => onChange(source)}
            className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
          >
            <SourceIcon source={source} size={20} />
            <Text className="text-lg">{SOURCE_LABELS[source]}</Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SourceSelector({ control, from, sources, walletTokenSymbol }: SourceSelectorProps) {
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
              sources={sources}
              walletTokenSymbol={walletTokenSymbol}
            />
          ) : (
            <SourceSelectorNative
              value={value}
              onChange={onChange}
              from={from}
              sources={sources}
              walletTokenSymbol={walletTokenSymbol}
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
  from: CardDepositSource;
  onAmountEntry?: () => void;
  /** Symbol for Wallet source (e.g. USDC.e or rUSD). */
  walletTokenSymbol: string;
  /** Optional override for the right-hand token cell (e.g. WalletTokenButton). */
  rightSlot?: React.ReactNode;
};

function AmountInput({
  control,
  errors,
  from,
  onAmountEntry,
  walletTokenSymbol,
  rightSlot,
}: AmountInputProps) {
  const getTokenImage = () => {
    if (from === CardDepositSource.SAVINGS) return getAsset('images/sousd-4x.png');
    return getAsset('images/usdc-4x.png');
  };

  const getTokenSymbol = useCallback(() => {
    if (from === CardDepositSource.WALLET) return walletTokenSymbol;
    if (from === CardDepositSource.SAVINGS) return 'soUSD';
    return 'USDC';
  }, [from, walletTokenSymbol]);

  return (
    <View className="gap-2">
      <Text className="font-medium opacity-50">Deposit amount</Text>
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
        {rightSlot ? (
          rightSlot
        ) : (
          <View className="native:shrink-0 flex-row items-center gap-2">
            <Image
              source={getTokenImage()}
              alt={getTokenSymbol()}
              style={{ width: 34, height: 34 }}
            />
            <Text className="text-lg font-semibold text-white">{getTokenSymbol()}</Text>
          </View>
        )}
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
  from: CardDepositSource;
  onMaxClick?: () => void;
  /** Symbol for Wallet source (e.g. USDC.e or rUSD). */
  walletTokenSymbol: string;
};

function BalanceDisplay({
  balanceAmount,
  isBalanceLoading,
  formattedBalance,
  setValue,
  trigger,
  from,
  onMaxClick,
  walletTokenSymbol,
}: BalanceDisplayProps) {
  const tokenSymbol = useMemo(() => {
    if (from === CardDepositSource.WALLET) return walletTokenSymbol;
    if (from === CardDepositSource.SAVINGS) return 'soUSD';
    return 'USDC';
  }, [from, walletTokenSymbol]);

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

function DestinationDisplay({
  fundingChainLabel,
  destinationTokenSymbol,
}: {
  fundingChainLabel: string;
  destinationTokenSymbol: string;
}) {
  return (
    <View className="gap-2">
      <Text className="font-medium opacity-50">To</Text>
      <View className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-semibold">Card ({fundingChainLabel})</Text>
        </View>
        <Text className="text-sm text-muted-foreground">{destinationTokenSymbol}</Text>
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
        <Text className="native:text-lg text-base font-bold text-black">Deposit to Card</Text>
      )}
    </Button>
  );
}

export default function CardDepositInternalForm() {
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivityActions();
  const { setTransaction, setModal, source } = useCardDepositStore(
    useShallow(state => ({
      setTransaction: state.setTransaction,
      setModal: state.setModal,
      source: state.source,
    })),
  );
  const { data: cardDetails } = useCardDetails();
  const { provider } = useCardProvider();
  const { data: contracts, isLoading: contractsLoading } = useCardContracts();
  const fundingChainId = EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID;
  const depositTokenAddressForBalance =
    !isProduction && provider ? (getCardDepositTokenAddress(fundingChainId) as Address) : undefined;

  // Tracking refs
  const hasTrackedFormViewedRef = useRef(false);
  const hasTrackedAmountEntryRef = useRef(false);
  const lastTrackedValidationErrorRef = useRef<string | null>(null);

  // Get all token balances including soUSD
  const { tokens, isLoading: isBalancesLoading } = useBalances();

  // Production "From Wallet" card deposit: read USDC balance from the Solid
  // Safe AA on the chain the user picked in the token selector. Falls back to
  // the Fuse-stargate legacy behaviour when the user hasn't picked anything
  // yet (cardDepositSrcChainId is 0 / unsupported).
  const cardDepositSrcChainId = useDepositStore(state => state.srcChainId);
  const selectedWalletUsdcAddress =
    (BRIDGE_TOKENS[cardDepositSrcChainId]?.tokens?.USDC?.address as Address | undefined) ??
    undefined;
  const hasSelectedWalletUsdc = !!cardDepositSrcChainId && !!selectedWalletUsdcAddress;
  const walletBalanceChainId = hasSelectedWalletUsdc ? cardDepositSrcChainId : fuse.id;
  const walletBalanceTokenAddress = hasSelectedWalletUsdc
    ? (selectedWalletUsdcAddress as Address)
    : USDC_STARGATE;
  const { data: walletUsdcBalance, isLoading: isUsdcBalanceLoading } = useReadContract({
    abi: erc20Abi,
    address: walletBalanceTokenAddress,
    functionName: 'balanceOf',
    args: [user?.safeAddress as Address],
    chainId: walletBalanceChainId,
    query: { enabled: !!user?.safeAddress && isProduction },
  });

  // Get soUSD balance from tokens
  const soUsdToken = useMemo(() => {
    return tokens.find(
      token =>
        token.contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase() &&
        token.chainId === fuse.id,
    );
  }, [tokens]);

  const { control, handleSubmit, formState, watch, reset, setValue, trigger } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      amount: '',
      // When no source is explicitly chosen, the funded source is selected once
      // balances load (see the effect below).
      from: source ?? CardDepositSource.WALLET,
    },
  });

  const watchedAmount = watch('amount');
  const watchedFrom = watch('from');

  // Testnet Wallet: rUSD balance on funding chain
  const { data: testnetDepositBalance, isLoading: isTestnetBalanceLoading } = useReadContract({
    abi: erc20Abi,
    address: depositTokenAddressForBalance,
    functionName: 'balanceOf',
    args: [user?.safeAddress as Address],
    chainId: fundingChainId,
    query: {
      enabled:
        !isProduction &&
        !!depositTokenAddressForBalance &&
        !!user?.safeAddress &&
        watchedFrom === CardDepositSource.WALLET,
    },
  });

  // soUSD → USD rate from the accountant contract (used for the Savings
  // exchange-rate analytics on submit).
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

  const { data: rate } = useReadContract({
    address: ADDRESSES.ethereum.accountant,
    abi: ACCOUNTANT_ABI,
    functionName: 'getRate',
    chainId: mainnet.id,
  });

  const usdcBalanceAmount = walletUsdcBalance ? Number(walletUsdcBalance) / 1e6 : 0;
  const soUsdBalanceAmount = soUsdToken
    ? Number(soUsdToken.balance) / Math.pow(10, soUsdToken.contractDecimals)
    : 0;
  const testnetWalletBalanceAmount =
    testnetDepositBalance != null ? Number(testnetDepositBalance) / 1e6 : 0;

  const balanceAmount =
    watchedFrom === CardDepositSource.WALLET
      ? isProduction
        ? usdcBalanceAmount
        : testnetWalletBalanceAmount
      : soUsdBalanceAmount;
  const isBalanceLoading =
    watchedFrom === CardDepositSource.WALLET
      ? isProduction
        ? isUsdcBalanceLoading
        : isTestnetBalanceLoading
      : isBalancesLoading;
  const walletTokenSymbol = isProduction
    ? cardDepositSrcChainId === fuse.id
      ? 'USDC.e'
      : 'USDC'
    : getCardDepositTokenSymbol(provider);
  const tokenSymbol =
    watchedFrom === CardDepositSource.WALLET
      ? walletTokenSymbol
      : watchedFrom === CardDepositSource.SAVINGS
        ? 'soUSD'
        : 'USDC';

  const exchangeRate = rate ? Number(formatUnits(rate, 6)) : 0;

  const { amountOut: estimatedUSDC, isLoading: isEstimatedUSDCLoading } = usePreviewDepositToCard(
    watchedAmount,
    ADDRESSES.fuse.stargateOftUSDC,
  );

  const isWalletSourceGaslessGated = isProduction && watchedFrom === CardDepositSource.WALLET;

  const schema = useMemo(() => {
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), { error: 'Enter a valid amount' })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} ${tokenSymbol}`,
        }),
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

  const { deposit, depositStatus, error: depositError } = useCardDeposit();

  const hasSelectedWalletToken =
    watchedFrom === CardDepositSource.WALLET && isProduction && hasSelectedWalletUsdc;
  const selectedCardWalletToken: TokenBalance | null = useMemo(() => {
    if (!hasSelectedWalletToken || !selectedWalletUsdcAddress) return null;
    return {
      contractTickerSymbol: walletTokenSymbol,
      contractName: 'USD Coin',
      contractAddress: selectedWalletUsdcAddress,
      balance: '0',
      contractDecimals: 6,
      type: TokenType.ERC20,
      chainId: cardDepositSrcChainId,
    };
  }, [hasSelectedWalletToken, selectedWalletUsdcAddress, walletTokenSymbol, cardDepositSrcChainId]);
  const {
    deposit: walletCardDeposit,
    depositStatus: walletCardDepositStatus,
    error: walletCardDepositError,
  } = useDepositFromSolidUsdc(
    (selectedWalletUsdcAddress ?? '') as Address,
    'USDC',
    EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
    DepositCategory.CARD,
  );

  // Track form viewed (once on mount)
  useEffect(() => {
    if (!hasTrackedFormViewedRef.current) {
      hasTrackedFormViewedRef.current = true;
      track(TRACKING_EVENTS.CARD_DEPOSIT_INTERNAL_FORM_VIEWED);
    }
  }, []);

  // Track source selection changes
  const previousSourceRef = useRef<CardDepositSource | null>(null);
  useEffect(() => {
    // Only track if the source actually changed (not on initial render)
    if (previousSourceRef.current !== null && previousSourceRef.current !== watchedFrom) {
      track(TRACKING_EVENTS.CARD_DEPOSIT_SOURCE_SELECTED, {
        source_type: watchedFrom,
        wallet_balance: usdcBalanceAmount,
        savings_balance: soUsdBalanceAmount,
      });
    }
    previousSourceRef.current = watchedFrom;
  }, [watchedFrom, usdcBalanceAmount, soUsdBalanceAmount]);

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

  const onSubmit = useCallback(
    async (data: any) => {
      if (!user) return;

      // Track submission
      const trackingParams: Record<string, unknown> = {
        source_type: watchedFrom,
        amount: data.amount,
        estimated_usdc_output:
          watchedFrom === CardDepositSource.SAVINGS ? estimatedUSDC : data.amount,
      };
      if (watchedFrom === CardDepositSource.SAVINGS) {
        trackingParams.exchange_rate = exchangeRate;
      }
      track(TRACKING_EVENTS.CARD_DEPOSIT_INTERNAL_SUBMITTED, trackingParams);

      try {
        if (watchedFrom === CardDepositSource.WALLET && !isProduction) {
          await deposit(data.amount);
          reset();
          return;
        }

        if (watchedFrom === CardDepositSource.WALLET && isProduction) {
          await walletCardDeposit(data.amount);
          setTransaction({ amount: Number(data.amount) });
          setModal(CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
          reset();
          return;
        }

        // Check for funding address
        if (!cardDetails) {
          Toast.show({
            type: 'error',
            text1: 'Card details not found',
            text2: 'Please try again later',
          });
          return;
        }
        const submitFundingAddress = getCardFundingAddress(
          cardDetails,
          provider,
          contracts ?? undefined,
        );

        if (!submitFundingAddress) {
          Toast.show({
            type: 'error',
            text1: 'Deposits not available',
            text2: 'This card does not support deposits to the funding chain',
            props: { badgeText: '' },
          });
          return;
        }

        const sourceSymbol = watchedFrom === CardDepositSource.SAVINGS ? 'soUSD' : 'USDC.e';
        const sourceTokenAddress =
          watchedFrom === CardDepositSource.SAVINGS ? ADDRESSES.fuse.vault : USDC_STARGATE;

        // Create activity event (stays PENDING until Bridge processes it)
        const clientTxId = await createActivity({
          type: TransactionType.BRIDGE_DEPOSIT,
          title: `Deposit ${sourceSymbol} to Card`,
          shortTitle: `Deposit ${sourceSymbol}`,
          amount: data.amount,
          symbol: sourceSymbol,
          chainId: fuse.id,
          fromAddress: user.safeAddress,
          toAddress: submitFundingAddress,
          status: TransactionStatus.PENDING,
          metadata: {
            description: `Deposit ${data.amount} ${sourceSymbol} to card`,
            processingStatus: 'bridging',
            tokenAddress: sourceTokenAddress,
          },
        });

        let tx: TransactionReceipt | undefined;

        if (watchedFrom === CardDepositSource.SAVINGS) {
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
      deposit,
      walletCardDeposit,
      estimatedUSDC,
      exchangeRate,
      cardDetails,
      provider,
      contracts,
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

  const isFundingAddressLoading = provider === CardProvider.RAIN && contractsLoading;
  const isWalletDepositPending =
    !isProduction && watchedFrom === CardDepositSource.WALLET && depositStatus === Status.PENDING;
  const isWalletCardDepositPending =
    isProduction &&
    watchedFrom === CardDepositSource.WALLET &&
    walletCardDepositStatus.status === Status.PENDING;
  const disabled =
    bridgeStatus === Status.PENDING ||
    swapAndBridgeStatus === Status.PENDING ||
    isWalletDepositPending ||
    isWalletCardDepositPending ||
    isEstimatedUSDCLoading ||
    isFundingAddressLoading ||
    (isWalletSourceGaslessGated && !hasSelectedWalletToken) ||
    !isValid ||
    !watchedAmount;

  // Show validation error message
  const validationError = useMemo(() => {
    if (!watchedAmount) return null;
    try {
      schema.parse({ amount: watchedAmount });
      return null;
    } catch (error: unknown) {
      const err = error as { issues?: { message?: string }[] };
      return err.issues?.[0]?.message ?? null;
    }
  }, [watchedAmount, schema]);

  // Track validation errors (only when error changes)
  useEffect(() => {
    if (validationError && validationError !== lastTrackedValidationErrorRef.current) {
      lastTrackedValidationErrorRef.current = validationError;
      // Determine error type
      let errorType = 'invalid_input';
      if (validationError.includes('balance')) {
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

  const showSavingsOption = isProduction;

  // Order the funding sources so the one the user actually has funds in is
  // shown first. Savings vs Wallet are sorted by balance (highest first);
  // External Wallet stays last.
  const sortedSources = useMemo<CardDepositSource[]>(() => {
    if (!showSavingsOption) {
      return [CardDepositSource.WALLET, CardDepositSource.EXTERNAL];
    }

    const balanceSources = [
      { source: CardDepositSource.WALLET, balance: usdcBalanceAmount },
      { source: CardDepositSource.SAVINGS, balance: soUsdBalanceAmount },
    ]
      .sort((a, b) => b.balance - a.balance)
      .map(item => item.source);

    return [...balanceSources, CardDepositSource.EXTERNAL];
  }, [showSavingsOption, usdcBalanceAmount, soUsdBalanceAmount]);

  // The funded source the form should open on — the first ordered option.
  const defaultSource = sortedSources[0];

  // When the modal is opened without an explicit source (the default "Add funds"
  // entry), select the source the user has funds in once balances have loaded.
  const hasAppliedDefaultSourceRef = useRef(false);
  useEffect(() => {
    if (hasAppliedDefaultSourceRef.current) return;
    // Respect an explicitly chosen source (options screen, token selector).
    if (source) {
      hasAppliedDefaultSourceRef.current = true;
      return;
    }
    // Wait until balances are known so we land on the source that has funds.
    if (isBalancesLoading || (isProduction && isUsdcBalanceLoading)) return;
    hasAppliedDefaultSourceRef.current = true;
    if (defaultSource && defaultSource !== watchedFrom) {
      setValue('from', defaultSource);
    }
  }, [source, isBalancesLoading, isUsdcBalanceLoading, defaultSource, watchedFrom, setValue]);

  const fundingAddress = useMemo(
    () => getCardFundingAddress(cardDetails, provider, contracts ?? undefined),
    [cardDetails, provider, contracts],
  );

  const externalWalletDescription = useMemo(
    () => (
      <View className="items-center gap-2">
        <Text className="max-w-72 text-center text-sm text-muted-foreground">
          Transfer USDC on Base chain.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(BASE_USDC_TOKEN_URL)}
          className="web:hover:opacity-50"
        >
          <View className="flex-row flex-wrap items-center">
            <Text className="text-sm font-medium text-white">See token address</Text>
            <ChevronRight size={16} color="white" />
          </View>
        </Pressable>
      </View>
    ),
    [],
  );

  return (
    <View className="flex-1 gap-3">
      <SourceSelector
        control={control}
        from={watchedFrom}
        sources={sortedSources}
        walletTokenSymbol={walletTokenSymbol}
      />

      {watchedFrom === CardDepositSource.EXTERNAL ? (
        <View className="flex-1 gap-3">
          {isFundingAddressLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="white" />
            </View>
          ) : (
            <DepositPublicAddress
              address={fundingAddress}
              description={externalWalletDescription}
            />
          )}
        </View>
      ) : (
        <View className="gap-2">
          <AmountInput
            control={control}
            errors={formState.errors}
            from={watchedFrom}
            onAmountEntry={trackAmountEntry}
            walletTokenSymbol={walletTokenSymbol}
            rightSlot={
              isWalletSourceGaslessGated ? (
                <WalletTokenButton
                  selectedToken={selectedCardWalletToken}
                  onPress={() => setModal(CARD_DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR)}
                />
              ) : undefined
            }
          />
          <BalanceDisplay
            balanceAmount={balanceAmount}
            isBalanceLoading={isBalanceLoading}
            formattedBalance={formattedBalance}
            setValue={setValue}
            trigger={trigger}
            from={watchedFrom}
            onMaxClick={trackMaxButtonClicked}
            walletTokenSymbol={walletTokenSymbol}
          />
        </View>
      )}

      {watchedFrom === CardDepositSource.SAVINGS && watchedAmount && (
        <EstimatedReceive
          estimatedUSDC={estimatedUSDC ? Number(estimatedUSDC) : 0}
          isLoading={isEstimatedUSDCLoading}
        />
      )}

      {watchedFrom !== CardDepositSource.EXTERNAL && <View className="flex-1" />}

      {/* {watchedFrom !== CardDepositSource.EXTERNAL && (
        <DestinationDisplay
          fundingChainLabel={getChain(fundingChainId)?.name ?? 'Card'}
          destinationTokenSymbol={getCardDepositTokenSymbol(provider)}
        />
      )} */}

      {isWalletSourceGaslessGated && (
        <View className="mt-2 flex-row items-start gap-2">
          <Fuel color="#A1A1A1" size={16} className="mt-0.5" />
          <Text className="max-w-xs text-sm" style={{ color: '#A1A1A1' }}>
            Gasless deposit
          </Text>
        </View>
      )}

      {watchedFrom !== CardDepositSource.EXTERNAL && (
        <ErrorDisplay
          error={
            validationError ||
            bridgeError ||
            swapAndBridgeError ||
            (!isProduction ? depositError : null) ||
            (isProduction && watchedFrom === CardDepositSource.WALLET
              ? walletCardDepositError
              : null)
          }
        />
      )}

      {watchedFrom === CardDepositSource.EXTERNAL ? null : (
        <SubmitButton
          disabled={disabled}
          bridgeStatus={
            !isProduction && watchedFrom === CardDepositSource.WALLET
              ? depositStatus
              : isProduction && watchedFrom === CardDepositSource.WALLET
                ? walletCardDepositStatus.status
                : bridgeStatus
          }
          swapAndBridgeStatus={swapAndBridgeStatus}
          onPress={handleSubmit(onSubmit)}
        />
      )}
    </View>
  );
}
