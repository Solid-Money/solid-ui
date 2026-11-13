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
import useUser from '@/hooks/useUser';
import { showFailureSheet } from '@/lib/errors';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  formatBtcAmount,
  SOBTC_DECIMALS,
  SOBTC_WITHDRAW_OPTION_ORDER,
  SOBTC_WITHDRAW_OPTIONS,
  type SoBtcChainId,
  soBtcSharesToAssets,
} from '@/lib/soBtc';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { withdrawRevertCopy } from '@/lib/utils/withdrawErrors';
import { useUnstakeStore } from '@/store/useUnstakeStore';
import { selectWithdrawSession, useWithdrawSessionStore } from '@/store/useWithdrawSessionStore';

/** The queue's solver discount, as the other withdraw forms show it. */
const SOLVER_FEE_BPS = 1n;

/** An option is "limited" when it can pay some, but less than the user holds. */
type OptionState = 'loading' | 'error' | 'available' | 'limited' | 'unavailable';

const optionState = (
  availability: SoBtcAvailability | undefined,
  isLoading: boolean,
  isError: boolean,
  balanceShares: bigint,
): OptionState => {
  if (isLoading) return 'loading';
  if (isError || !availability) return 'error';
  if (availability.maxShares <= 0n) return 'unavailable';
  if (balanceShares > 0n && availability.maxShares < balanceShares) return 'limited';
  return 'available';
};

const toBtc = (sats: bigint) => Number(formatUnits(sats, SOBTC_DECIMALS));

/**
 * soBTC withdraw: the user picks what they receive, cbBTC on Base or WBTC on Ethereum.
 *
 * All soBTC sits on Base, so the choice is not where the shares are but which vault pays. Each
 * vault pays only from what it holds right now, so each option shows its "available now", Max is
 * capped at it, and an amount over it offers the available amount or the other option.
 *
 * cbBTC: one step on the Base queue. WBTC: move the shares to Ethereum (LayerZero, fee in ETH on
 * Base), then request on the Ethereum queue; a closed flow resumes on step 2, as for soETH.
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

  const [chainId, setChainId] = useState<SoBtcChainId>(base.id);
  const [amount, setAmount] = useState('');
  // A resumed WBTC withdrawal: the shares are on Ethereum, step 2 is next.
  useEffect(() => {
    if (session) {
      setChainId(mainnet.id);
      setAmount(session.amount);
    }
  }, [session]);

  // Shares by chain: always on Base, except between the two steps of a WBTC withdrawal.
  const shareRead = (chain: SoBtcChainId) => ({
    abi: erc20Abi,
    address: SOBTC_WITHDRAW_OPTIONS[chain].vault,
    functionName: 'balanceOf' as const,
    args: [safe as Address] as const,
    chainId: chain,
    query: { enabled: !!safe, refetchInterval: 15_000 },
  });
  const { data: baseShares, isLoading: isBaseSharesLoading } = useReadContract(shareRead(base.id));
  const { data: ethereumShares, isLoading: isEthereumSharesLoading } = useReadContract(
    shareRead(mainnet.id),
  );

  const availability = {
    [base.id]: useSoBtcAvailability(base.id),
    [mainnet.id]: useSoBtcAvailability(mainnet.id),
  } as const;
  const btcPrice = useBtcPriceUsd(true);

  const option = SOBTC_WITHDRAW_OPTIONS[chainId];
  const isWbtc = chainId === mainnet.id;
  // WBTC with shares already on Ethereum (resumed, or an earlier bridge): straight to step 2.
  const hasEthereumShares = (ethereumShares ?? 0n) > 0n;
  const isStep2 = isWbtc && (!!session || hasEthereumShares);
  const balanceShares = isStep2 ? (ethereumShares ?? 0n) : (baseShares ?? 0n);
  const isBalanceLoading = isStep2 ? isEthereumSharesLoading : isBaseSharesLoading;

  const selected = availability[chainId];
  const maxShares = selected.data
    ? balanceShares < selected.data.maxShares
      ? balanceShares
      : selected.data.maxShares
    : balanceShares;

  const amountShares = useMemo(() => {
    try {
      return amount ? parseUnits(amount.trim(), SOBTC_DECIMALS) : 0n;
    } catch {
      return undefined;
    }
  }, [amount]);

  const rate = selected.data?.rate;
  const receiveSats =
    amountShares && rate
      ? (soBtcSharesToAssets(amountShares, rate) * (10_000n - SOLVER_FEE_BPS)) / 10_000n
      : 0n;
  const amountBtc = amountShares && rate ? toBtc(soBtcSharesToAssets(amountShares, rate)) : 0;

  const otherChainId: SoBtcChainId = isWbtc ? base.id : mainnet.id;
  const other = availability[otherChainId].data;
  const otherFits = !!other && !!amountShares && other.maxShares >= amountShares && !session;

  const validation: string | null = useMemo(() => {
    if (!amount) return null;
    if (amountShares === undefined) return 'Please enter a valid amount';
    if (amountShares <= 0n) return 'Amount must be greater than 0';
    if (amountShares > balanceShares) {
      return `Available balance is ${formatBtcAmount(toBtc(balanceShares), 'soBTC')}`;
    }
    return null;
  }, [amount, amountShares, balanceShares]);
  // Over what the chosen vault can pay right now: its own message, with the two ways out.
  const isOverAvailable =
    !validation && !!amountShares && !!selected.data && amountShares > selected.data.maxShares;

  const { withdrawSoBtc, withdrawSoBtcStatus } = useWithdrawSoBtc(chainId);
  const { bridgeSoBtc, bridgeSoBtcStatus } = useBridgeSoBtcToEthereum();
  const isWithdrawing = withdrawSoBtcStatus === Status.PENDING;
  const isBridging = bridgeSoBtcStatus === Status.PENDING;
  const isBusy = isWithdrawing || isBridging;

  const canSubmit =
    !!amountShares &&
    amountShares > 0n &&
    !validation &&
    !isOverAvailable &&
    !selected.isLoading &&
    !selected.isError &&
    !isBusy;

  const setShares = (shares: bigint) => setAmount(formatUnits(shares, SOBTC_DECIMALS));

  const onWithdraw = async () => {
    if (!amountShares) return;
    try {
      const transaction = await withdrawSoBtc(amount.trim());
      setTransaction({ amount: Number(amount), symbol: 'soBTC' });
      if (isWbtc) clearSession('BTC');
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

        {/* Receive as */}
        <View className="mt-4 gap-2">
          <Text className="text-base font-medium opacity-70">Receive as</Text>
          {SOBTC_WITHDRAW_OPTION_ORDER.map(id => {
            const item = SOBTC_WITHDRAW_OPTIONS[id];
            const query = availability[id];
            const shares =
              id === mainnet.id && hasEthereumShares ? (ethereumShares ?? 0n) : (baseShares ?? 0n);
            const state = optionState(query.data, query.isLoading, query.isError, shares);
            const isSelected = id === chainId;
            // A resumed WBTC withdrawal is locked to WBTC: its shares are already on Ethereum.
            const isLocked = !!session && id !== mainnet.id;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, disabled: isLocked }}
                disabled={isLocked || isBusy}
                onPress={() => setChainId(id)}
                className={cn(
                  'gap-1 rounded-2xl border bg-card p-4',
                  isSelected ? 'border-brand' : 'border-transparent',
                  (isLocked || state === 'unavailable') && 'opacity-50',
                )}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <RenderTokenIcon
                      tokenIcon={getTokenIcon({ tokenSymbol: item.asset, size: 28 })}
                      size={28}
                    />
                    <Text className="text-base font-semibold">
                      {item.asset} on {item.networkName}
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
                          : `Up to ${formatBtcAmount(toBtc(query.data!.availableSats))} now`}
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {item.timeLabel} · {item.costLabel}
                </Text>
              </Pressable>
            );
          })}
          {isOverAvailable && selected.data && (
            <View className="gap-3 rounded-2xl bg-card p-4">
              <Text className="text-sm text-yellow-400">
                Only {formatBtcAmount(toBtc(selected.data.availableSats))} can be withdrawn as{' '}
                {option.asset} right now.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {maxShares > 0n && (
                  <Button
                    variant="secondary"
                    className="h-10 rounded-xl"
                    onPress={() => setShares(maxShares)}
                  >
                    <Text className="text-sm font-semibold">
                      Withdraw {formatBtcAmount(toBtc(maxShares), '')}
                    </Text>
                  </Button>
                )}
                {otherFits && (
                  <Button
                    variant="secondary"
                    className="h-10 rounded-xl"
                    onPress={() => setChainId(otherChainId)}
                  >
                    <Text className="text-sm font-semibold">
                      Switch to {SOBTC_WITHDRAW_OPTIONS[otherChainId].asset} on{' '}
                      {SOBTC_WITHDRAW_OPTIONS[otherChainId].networkName}
                    </Text>
                  </Button>
                )}
              </View>
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

        <Text className="text-base font-medium opacity-70">Actions</Text>
        <TokenDetails>
          {isWbtc ? (
            <>
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
            </>
          ) : (
            <ActionStep
              icon="cbBTC"
              title="Withdraw to cbBTC"
              hint={SOBTC_WITHDRAW_OPTIONS[base.id].timeLabel}
              label="Withdraw"
              isActive
              isLoading={isWithdrawing}
              disabled={!canSubmit}
              onPress={onWithdraw}
            />
          )}
        </TokenDetails>
        <View className="mt-2 flex-row items-center justify-center gap-2 pb-16">
          <NeedHelp />
        </View>
      </View>
    </Pressable>
  );
};

/** One action row: a numbered step of the WBTC flow, or the single cbBTC withdraw. */
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
  step?: number;
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
        {step !== undefined && (
          <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-muted-foreground/20">
            <Text className="text-base font-medium text-muted-foreground">{step}</Text>
          </View>
        )}
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
