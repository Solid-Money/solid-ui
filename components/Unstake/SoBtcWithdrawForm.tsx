import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { type Address, erc20Abi, formatUnits, parseUnits } from 'viem';
import { base, mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';
import { useShallow } from 'zustand/react/shallow';

import Max from '@/components/Max';
import NeedHelp from '@/components/NeedHelp';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TierBalanceOutflowNotice from '@/components/TierBalance/TierBalanceOutflowNotice';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { useBtcPriceUsd } from '@/hooks/useBtcPriceUsd';
import {
  type SoBtcAvailability,
  useBridgeSoBtcToEthereum,
  useSoBtcAvailability,
  useWithdrawSoBtc,
} from '@/hooks/useSoBtcWithdraw';
import { useTierBalanceOutflowWarning } from '@/hooks/useTierBalance';
import useUser from '@/hooks/useUser';
import { showFailureSheet } from '@/lib/errors';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  formatBtcAmount,
  SOBTC_CHAINS,
  SOBTC_DECIMALS,
  SOBTC_WITHDRAW,
  type SoBtcChainId,
  soBtcSharesToAssets,
} from '@/lib/soBtc';
import { fixedPointUsd } from '@/lib/tierBalance';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { withdrawRevertCopy } from '@/lib/utils/withdrawErrors';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { selectWithdrawSession, useWithdrawSessionStore } from '@/store/useWithdrawSessionStore';

/** The queue's solver discount, as the other withdraw forms show it. */
const SOLVER_FEE_BPS = 1n;

/** "limited" when the Ethereum vault can pay some, but less than the user holds. */
type AvailabilityState = 'loading' | 'error' | 'available' | 'limited' | 'unavailable';

const availabilityState = (
  availability: SoBtcAvailability | undefined,
  isLoading: boolean,
  isError: boolean,
  balanceShares: bigint,
): AvailabilityState => {
  if (isLoading) return 'loading';
  if (isError || !availability) return 'error';
  if (availability.maxShares <= 0n) return 'unavailable';
  if (balanceShares > 0n && availability.maxShares < balanceShares) return 'limited';
  return 'available';
};

const toBtc = (sats: bigint) => Number(formatUnits(sats, SOBTC_DECIMALS));

/**
 * soBTC withdraw: every withdrawal pays WBTC on Ethereum.
 *
 * The shares sit on Base, so it takes two steps: move them to Ethereum (LayerZero, fee in ETH on
 * Base), then request on the Ethereum queue; a closed flow resumes on step 2, as for soETH. The
 * Ethereum vault pays only from what it holds right now, so the form shows its "available now",
 * Max is capped at it, and an amount over it offers the available amount.
 */
const SoBtcWithdrawForm = () => {
  const { user } = useUser();
  const safe = user?.safeAddress as Address | undefined;
  const { setModal, setTransaction } = useUnstakeStore(
    useShallow(state => ({ setModal: state.setModal, setTransaction: state.setTransaction })),
  );
  const { sessions, clearSession } = useWithdrawSessionStore(
    useShallow(state => ({ sessions: state.sessions, clearSession: state.clearSession })),
  );
  const session = useMemo(() => selectWithdrawSession(sessions, 'BTC', safe), [sessions, safe]);

  const [amount, setAmount] = useState('');
  // A resumed withdrawal: the shares are on Ethereum, step 2 is next.
  useEffect(() => {
    if (session) setAmount(session.amount);
  }, [session]);

  // Shares by chain: always on Base, except between the two steps of a withdrawal.
  const shareRead = (chainId: SoBtcChainId) => ({
    abi: erc20Abi,
    address: SOBTC_CHAINS[chainId].vault,
    functionName: 'balanceOf' as const,
    args: [safe as Address] as const,
    chainId,
    query: { enabled: !!safe, refetchInterval: 15_000 },
  });
  const { data: baseShares, isLoading: isBaseSharesLoading } = useReadContract(shareRead(base.id));
  const { data: ethereumShares, isLoading: isEthereumSharesLoading } = useReadContract(
    shareRead(mainnet.id),
  );

  const availability = useSoBtcAvailability();
  const btcPrice = useBtcPriceUsd(true);

  const option = SOBTC_WITHDRAW;
  // Straight to step 2 for a resumed withdrawal, or whenever soBTC already sits on Ethereum (an
  // earlier bridge whose request was cancelled or only partly made). Those shares need no bridge,
  // and no Base ETH for its fee, so they are requested first; once the queue holds them the
  // Ethereum balance is zero and the Base shares come up on step 1.
  const hasEthereumShares = (ethereumShares ?? 0n) > 0n;
  const isStep2 = !!session || hasEthereumShares;
  const balanceShares = isStep2 ? (ethereumShares ?? 0n) : (baseShares ?? 0n);
  const isBalanceLoading = isStep2 ? isEthereumSharesLoading : isBaseSharesLoading;

  const maxShares = availability.data
    ? balanceShares < availability.data.maxShares
      ? balanceShares
      : availability.data.maxShares
    : balanceShares;

  const amountShares = useMemo(() => {
    try {
      return amount ? parseUnits(amount.trim(), SOBTC_DECIMALS) : 0n;
    } catch {
      return undefined;
    }
  }, [amount]);

  const rate = availability.data?.rate;
  const receiveSats =
    amountShares && rate
      ? (soBtcSharesToAssets(amountShares, rate) * (10_000n - SOLVER_FEE_BPS)) / 10_000n
      : 0n;
  const amountBtc = amountShares && rate ? toBtc(soBtcSharesToAssets(amountShares, rate)) : 0;
  // What leaves Earn, at the price the USD line under the amount already uses.
  // Valued from the BTC the shares are worth, in sats, without a float in between.
  const { warning: tierBalanceWarning, proceed: proceedPastWarning } = useTierBalanceOutflowWarning(
    'withdraw',
    amountShares && rate
      ? fixedPointUsd(soBtcSharesToAssets(amountShares, rate), SOBTC_DECIMALS, btcPrice)
      : 0,
  );

  const validation: string | null = useMemo(() => {
    if (!amount) return null;
    if (amountShares === undefined) return 'Please enter a valid amount';
    if (amountShares <= 0n) return 'Amount must be greater than 0';
    if (amountShares > balanceShares) {
      return `Available balance is ${formatBtcAmount(toBtc(balanceShares), 'soBTC')}`;
    }
    return null;
  }, [amount, amountShares, balanceShares]);
  // Over what the Ethereum vault can pay right now: its own message, with the amount it can.
  const isOverAvailable =
    !validation &&
    !!amountShares &&
    !!availability.data &&
    amountShares > availability.data.maxShares;

  const { withdrawSoBtc, withdrawSoBtcStatus } = useWithdrawSoBtc();
  const { bridgeSoBtc, bridgeSoBtcStatus } = useBridgeSoBtcToEthereum();
  const isWithdrawing = withdrawSoBtcStatus === Status.PENDING;
  const isBridging = bridgeSoBtcStatus === Status.PENDING;
  const isBusy = isWithdrawing || isBridging;

  const canSubmit =
    !!amountShares &&
    amountShares > 0n &&
    !validation &&
    !isOverAvailable &&
    !availability.isLoading &&
    !availability.isError &&
    !isBusy;

  const setShares = (shares: bigint) => setAmount(formatUnits(shares, SOBTC_DECIMALS));

  const onWithdraw = async () => {
    if (!amountShares) return;
    proceedPastWarning();
    try {
      const transaction = await withdrawSoBtc(amount.trim());
      setTransaction({ amount: Number(amount), symbol: 'soBTC' });
      clearSession('BTC');
      setAmount('');
      setModal(UNSTAKE_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Withdraw submitted',
        text2: `${amount} soBTC → ${option.asset} on ${option.networkName}`,
        props: {
          badgeText: 'Onchain',
          link: `${option.chain.blockExplorers?.default.url}/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: getTokenIcon({ tokenSymbol: option.asset }),
        },
      });
    } catch (error) {
      void showFailureSheet(error, {
        action: 'withdraw',
        body: withdrawRevertCopy(error),
        details: { amount, token: 'soBTC' },
      });
    }
  };

  const onBridge = async () => {
    proceedPastWarning();
    try {
      await bridgeSoBtc(amount.trim());
      setTransaction({ amount: Number(amount), symbol: 'soBTC' });
    } catch (error) {
      void showFailureSheet(error, {
        action: 'withdraw',
        body: withdrawRevertCopy(error),
        details: { amount, token: 'soBTC' },
      });
    }
  };

  const usdLabel =
    btcPrice > 0 && amountBtc > 0 ? `$${formatNumber(amountBtc * btcPrice, 2)}` : '$0.00';
  const state = availabilityState(
    availability.data,
    availability.isLoading,
    availability.isError,
    balanceShares,
  );

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-4">
        {/* Amount */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium opacity-70">Amount</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-base opacity-50">
                {isBalanceLoading ? '...' : formatBtcAmount(toBtc(balanceShares), 'soBTC')}
              </Text>
              {maxShares > 0n && !session && <Max onPress={() => setShares(maxShares)} />}
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-card p-4">
            <View className="min-w-0 flex-1">
              <TextInput
                className={cn(
                  'flex-1 text-3xl font-semibold text-white web:focus:outline-none',
                  !!session && 'opacity-60',
                )}
                placeholder="0.0"
                placeholderTextColor="#ffffff80"
                value={amount}
                onChangeText={setAmount}
                editable={!session && !isBusy}
                keyboardType="decimal-pad"
                style={{ minWidth: 80 }}
                returnKeyType="done"
              />
              <Text className="text-sm opacity-50">{usdLabel}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <RenderTokenIcon
                tokenIcon={getTokenIcon({ tokenSymbol: 'soBTC', size: 28 })}
                size={28}
              />
              <Text className="text-base font-semibold">soBTC</Text>
            </View>
          </View>
          {validation && <Text className="text-sm text-red-400">{validation}</Text>}
        </View>

        {/* Receive as: WBTC on Ethereum, the only payout */}
        <View className="mt-4 gap-2">
          <Text className="text-base font-medium opacity-70">Receive as</Text>
          <View
            className={cn(
              'gap-1 rounded-2xl border border-brand bg-card p-4',
              state === 'unavailable' && 'opacity-50',
            )}
          >
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <RenderTokenIcon
                  tokenIcon={getTokenIcon({ tokenSymbol: option.asset, size: 28 })}
                  size={28}
                />
                <Text className="text-base font-semibold">
                  {option.asset} on {option.networkName}
                </Text>
              </View>
              <Text
                className={cn(
                  'text-sm',
                  state === 'available' && 'text-brand',
                  state === 'limited' && 'text-yellow-400',
                  (state === 'unavailable' || state === 'error') && 'text-red-400',
                  state === 'loading' && 'text-muted-foreground',
                )}
              >
                {state === 'loading'
                  ? 'Checking…'
                  : state === 'error'
                    ? "Couldn't check"
                    : state === 'unavailable'
                      ? 'None available now'
                      : `Up to ${formatBtcAmount(toBtc(availability.data!.availableSats))} now`}
              </Text>
            </View>
            <Text className="text-sm text-muted-foreground">
              {option.timeLabel} · {option.costLabel}
            </Text>
          </View>
          {isOverAvailable && availability.data && (
            <View className="gap-3 rounded-2xl bg-card p-4">
              <Text className="text-sm text-yellow-400">
                Only {formatBtcAmount(toBtc(availability.data.availableSats))} can be withdrawn as{' '}
                {option.asset} right now.
              </Text>
              {maxShares > 0n && (
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="h-10 rounded-xl"
                    onPress={() => setShares(maxShares)}
                  >
                    <Text className="text-sm font-semibold">
                      Withdraw {formatBtcAmount(toBtc(maxShares), '')}
                    </Text>
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>

        <TokenDetails>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">Solver fee</Text>
            <Text className="text-base font-semibold">0.01%</Text>
          </View>
          <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
            <Text className="text-base text-muted-foreground">You will receive</Text>
            <Text className="text-base font-semibold">
              {formatBtcAmount(toBtc(receiveSats), option.asset)}
            </Text>
          </View>
        </TokenDetails>

        <TierBalanceOutflowNotice warning={tierBalanceWarning} />

        <Text className="text-base font-medium opacity-70">Actions</Text>
        <TokenDetails>
          <ActionStep
            step={1}
            icon="soBTC"
            title="Move to Ethereum"
            hint="~2 min"
            label="Move"
            isActive={!isStep2}
            isLoading={isBridging}
            disabled={isStep2 || !canSubmit}
            onPress={onBridge}
          />
          <View className="border-b border-border/40" />
          <ActionStep
            step={2}
            icon="WBTC"
            title="Withdraw to WBTC"
            hint="Usually within 3 days"
            label="Withdraw"
            isActive={isStep2}
            isLoading={isWithdrawing}
            disabled={!isStep2 || !canSubmit}
            onPress={onWithdraw}
          />
        </TokenDetails>
        <View className="mt-2 flex-row items-center justify-center gap-2 pb-16">
          <NeedHelp />
        </View>
      </View>
    </Pressable>
  );
};

/** One numbered action row of the withdrawal. */
const ActionStep = ({
  step,
  icon,
  title,
  hint,
  label,
  isActive,
  isLoading,
  disabled,
  onPress,
}: {
  step: number;
  icon: string;
  title: string;
  hint: string;
  label: string;
  isActive: boolean;
  isLoading: boolean;
  disabled: boolean;
  onPress: () => void;
}) => {
  const tint = isActive ? '#18181b' : 'rgba(255, 255, 255, 0.5)';
  return (
    <View className="px-5 py-6 md:p-5">
      <View className="mb-4 flex-row items-center gap-2">
        <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-muted-foreground/20">
          <Text className="text-base font-medium text-muted-foreground">{step}</Text>
        </View>
        <View className="flex-1 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <RenderTokenIcon tokenIcon={getTokenIcon({ tokenSymbol: icon, size: 22 })} size={22} />
            <Text className="text-base font-bold text-white">{title}</Text>
          </View>
          <Text className="text-base font-medium text-muted-foreground">{hint}</Text>
        </View>
      </View>
      <Button
        variant="brand"
        className={cn(
          'h-[48px] rounded-[12px]',
          !isActive && 'bg-white/10 web:disabled:hover:bg-white/10',
          isActive && 'web:disabled:hover:bg-brand',
        )}
        onPress={onPress}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="black" />
        ) : (
          <View className="flex-row items-center gap-2">
            <Image
              source={require('@/assets/images/key.png')}
              tintColor={tint}
              className="h-6 w-6"
              contentFit="contain"
            />
            <Text className="text-base font-bold" style={{ color: tint }}>
              {label}
            </Text>
          </View>
        )}
      </Button>
    </View>
  );
};

export default SoBtcWithdrawForm;
